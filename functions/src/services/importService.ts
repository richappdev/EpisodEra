import {createHash, randomUUID} from "node:crypto";
import {FieldValue, QueryDocumentSnapshot, Timestamp, getFirestore, type CollectionReference} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {
  ImportEpisodeInput,
  ImportJobSummary,
  ImportMappingSkippedShow,
  ImportProvider,
  ImportReport,
  ImportReportRow,
  ImportRunResult,
  ImportStatus,
  ImportWatchlistItemInput,
  StagedEpisodeStatus,
  importProviders,
} from "../models/import";
import {WatchlistStatus, movieWatchlistStatuses, tvWatchlistStatuses} from "../models/watchlist";
import {stagedEpisodeDocId, stagedShowDocId} from "./importLogic";
import {episodeKeyFor} from "./progressLogic";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

const maxStageChunk = 200;
const maxRunEpisodeWrites = 100;
const maxReportRows = 500;

const stagingDeletePageSize = 400;

interface ImportDocument {
  provider: ImportProvider;
  status: ImportStatus;
  sourceHash?: string | null;
  watchlistStaged: number;
  episodesStaged: number;
  watchlistImported: number;
  episodesImported: number;
  episodesSkipped: number;
  episodesFailed: number;
  errorMessage?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp | null;
  stagingClearedAt?: Timestamp | null;
  stagingDocsDeleted?: number;
  mappingSkippedShows?: ImportMappingSkippedShow[];
  report?: ImportReport | null;
}

interface StagedShowDocument {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  status: WatchlistStatus;
  sourceShowId?: string | null;
  imported?: boolean;
}

interface StagedEpisodeDocument {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string | null;
  sourceShowId?: string | null;
  sourceEpisodeId?: string | null;
  bulkType?: string | null;
  status: StagedEpisodeStatus;
  skipReason?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const timestampToJson = (value: Timestamp | undefined | null) =>
  value ? value.toDate().toISOString() : null;

const positiveInteger = (value: unknown, field: string) => {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, "invalid_import_payload");
  }
  return numberValue;
};

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const parseCreateImportInput = (body: unknown): {provider: ImportProvider; sourceHash: string | null} => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_import_payload");
  }

  const provider = body.provider ?? "tv_time";
  if (typeof provider !== "string" || !importProviders.includes(provider as ImportProvider)) {
    throw new HttpError(400, "provider must be tv_time.", "invalid_import_provider");
  }

  return {
    provider: provider as ImportProvider,
    sourceHash: optionalString(body.sourceHash),
  };
};

export const parseCommitImportInput = (body: unknown): {skippedShows: ImportMappingSkippedShow[]} => {
  if (body == null) {
    return {skippedShows: []};
  }
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_import_payload");
  }
  if (body.skippedShows == null) {
    return {skippedShows: []};
  }
  if (!Array.isArray(body.skippedShows)) {
    throw new HttpError(400, "skippedShows must be an array.", "invalid_import_payload");
  }
  if (body.skippedShows.length > 500) {
    throw new HttpError(400, "skippedShows cannot contain more than 500 entries.", "invalid_import_payload");
  }

  return {
    skippedShows: body.skippedShows.map((item, index) => {
      if (!isRecord(item)) {
        throw new HttpError(400, `skippedShows[${index}] must be an object.`, "invalid_import_payload");
      }
      const title = optionalString(item.title);
      if (!title) {
        throw new HttpError(400, `skippedShows[${index}].title is required.`, "invalid_import_payload");
      }
      return {
        title,
        sourceShowId: optionalString(item.sourceShowId),
        reason: optionalString(item.reason) ?? "unresolved",
      };
    }),
  };
};

export const parseWatchlistStageInput = (body: unknown): ImportWatchlistItemInput[] => {
  if (!isRecord(body) || !Array.isArray(body.items)) {
    throw new HttpError(400, "items must be an array.", "invalid_import_payload");
  }

  if (body.items.length === 0 || body.items.length > maxStageChunk) {
    throw new HttpError(400, `items must contain 1–${maxStageChunk} entries.`, "invalid_import_payload");
  }

  return body.items.map((item, index) => {
    if (!isRecord(item)) {
      throw new HttpError(400, `items[${index}] must be an object.`, "invalid_import_payload");
    }

    const mediaType = item.mediaType;
    if (mediaType !== "movie" && mediaType !== "tv") {
      throw new HttpError(400, `items[${index}].mediaType must be movie or tv.`, "invalid_import_payload");
    }

    const status = item.status;
    const allowed = mediaType === "movie" ? movieWatchlistStatuses : tvWatchlistStatuses;
    if (typeof status !== "string" || !allowed.includes(status as never)) {
      throw new HttpError(400, `items[${index}].status is invalid for ${mediaType}.`, "invalid_import_payload");
    }

    if (typeof item.title !== "string" || !item.title.trim()) {
      throw new HttpError(400, `items[${index}].title is required.`, "invalid_import_payload");
    }

    return {
      tmdbId: positiveInteger(item.tmdbId, `items[${index}].tmdbId`),
      mediaType,
      title: item.title.trim(),
      poster: optionalString(item.poster),
      backdrop: optionalString(item.backdrop),
      status: status as WatchlistStatus,
      sourceShowId: optionalString(item.sourceShowId),
    };
  });
};

export const parseEpisodeStageInput = (body: unknown): ImportEpisodeInput[] => {
  if (!isRecord(body) || !Array.isArray(body.episodes)) {
    throw new HttpError(400, "episodes must be an array.", "invalid_import_payload");
  }

  if (body.episodes.length === 0 || body.episodes.length > maxStageChunk) {
    throw new HttpError(400, `episodes must contain 1–${maxStageChunk} entries.`, "invalid_import_payload");
  }

  return body.episodes.map((episode, index) => {
    if (!isRecord(episode)) {
      throw new HttpError(400, `episodes[${index}] must be an object.`, "invalid_import_payload");
    }

    return {
      tmdbId: positiveInteger(episode.tmdbId, `episodes[${index}].tmdbId`),
      seasonNumber: positiveInteger(episode.seasonNumber, `episodes[${index}].seasonNumber`),
      episodeNumber: positiveInteger(episode.episodeNumber, `episodes[${index}].episodeNumber`),
      watchedAt: optionalString(episode.watchedAt),
      sourceShowId: optionalString(episode.sourceShowId),
      sourceEpisodeId: optionalString(episode.sourceEpisodeId),
      bulkType: optionalString(episode.bulkType),
    };
  });
};

class ImportService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("imports");
  }

  private mapImport(importId: string, data: ImportDocument): ImportJobSummary {
    return {
      importId,
      provider: data.provider,
      status: data.status,
      sourceHash: data.sourceHash ?? null,
      watchlistStaged: data.watchlistStaged ?? 0,
      episodesStaged: data.episodesStaged ?? 0,
      watchlistImported: data.watchlistImported ?? 0,
      episodesImported: data.episodesImported ?? 0,
      episodesSkipped: data.episodesSkipped ?? 0,
      episodesFailed: data.episodesFailed ?? 0,
      errorMessage: data.errorMessage ?? null,
      createdAt: timestampToJson(data.createdAt),
      updatedAt: timestampToJson(data.updatedAt),
      completedAt: timestampToJson(data.completedAt ?? null),
      stagingClearedAt: timestampToJson(data.stagingClearedAt ?? null),
      stagingDocsDeleted: data.stagingDocsDeleted ?? 0,
      report: data.report ?? null,
    };
  }

  private async collectEpisodeReportRows(
    collectionRef: CollectionReference,
    status: "failed" | "skipped",
    titleByTmdbId: Map<number, string>,
    limit: number,
  ): Promise<ImportReportRow[]> {
    if (limit <= 0) {
      return [];
    }
    const snapshot = await collectionRef.where("status", "==", status).limit(limit).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as StagedEpisodeDocument;
      return {
        kind: status === "failed" ? "failed_episode" : "skipped_episode",
        title: titleByTmdbId.get(data.tmdbId) ?? null,
        tmdbId: data.tmdbId,
        seasonNumber: data.seasonNumber,
        episodeNumber: data.episodeNumber,
        reason: data.skipReason ?? (status === "failed" ? "failed" : "already_watched"),
        sourceShowId: data.sourceShowId ?? null,
      };
    });
  }

  /** Snapshot skip/fail rows before staging cleanup so the client can download a report. */
  private async buildImportReport(
    userId: string,
    importId: string,
    job: ImportDocument,
  ): Promise<ImportReport> {
    const ref = this.collection(userId).doc(importId);
    const mappingSkippedShows = job.mappingSkippedShows ?? [];
    const failedEpisodeCount = job.episodesFailed ?? 0;
    const skippedEpisodeCount = job.episodesSkipped ?? 0;

    const showsSnapshot = await ref.collection("stagedShows").limit(500).get();
    const titleByTmdbId = new Map<number, string>();
    for (const doc of showsSnapshot.docs) {
      const show = doc.data() as StagedShowDocument;
      titleByTmdbId.set(show.tmdbId, show.title);
    }

    const episodesRef = ref.collection("stagedEpisodes");
    const showRows: ImportReportRow[] = mappingSkippedShows.slice(0, maxReportRows).map((show) => ({
      kind: "skipped_show",
      title: show.title,
      tmdbId: null,
      seasonNumber: null,
      episodeNumber: null,
      reason: show.reason,
      sourceShowId: show.sourceShowId,
    }));

    const remainingBudget = Math.max(0, maxReportRows - showRows.length);
    const failedBudget = Math.min(remainingBudget, failedEpisodeCount);
    const failedRows = await this.collectEpisodeReportRows(
      episodesRef,
      "failed",
      titleByTmdbId,
      failedBudget,
    );
    const skippedBudget = Math.min(
      Math.max(0, remainingBudget - failedRows.length),
      skippedEpisodeCount,
    );
    const skippedRows = await this.collectEpisodeReportRows(
      episodesRef,
      "skipped",
      titleByTmdbId,
      skippedBudget,
    );

    const rows = [...showRows, ...failedRows, ...skippedRows];
    const truncated =
      mappingSkippedShows.length > showRows.length ||
      failedEpisodeCount > failedRows.length ||
      skippedEpisodeCount > skippedRows.length;

    return {
      generatedAt: new Date().toISOString(),
      failedEpisodeCount,
      skippedEpisodeCount,
      skippedShowCount: mappingSkippedShows.length,
      truncated,
      rows,
    };
  }

  /** Deletes stagedShows/stagedEpisodes in pages; keeps the parent import job document. */
  private async deleteCollectionDocs(collectionRef: CollectionReference): Promise<number> {
    let deleted = 0;
    for (;;) {
      const snapshot = await collectionRef.limit(stagingDeletePageSize).get();
      if (snapshot.empty) {
        break;
      }
      const batch = getFirestore().batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += snapshot.size;
    }
    return deleted;
  }

  private async clearStaging(userId: string, importId: string): Promise<number> {
    const ref = this.collection(userId).doc(importId);
    const showsDeleted = await this.deleteCollectionDocs(ref.collection("stagedShows"));
    const episodesDeleted = await this.deleteCollectionDocs(ref.collection("stagedEpisodes"));

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {deleteImportStagedShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "importStaging",
      operation: "clearStaging",
      firebaseUid: userId,
      operationId: `importStaging:clear:${userId}:${importId}:${Date.now()}`,
      payload: {importId},
      write: () => deleteImportStagedShadow(importId),
    });

    return showsDeleted + episodesDeleted;
  }

  /** Re-read job after Firestore write and shadow metadata to Supabase (staging stays Firestore). */
  private async shadowImportJob(
    userId: string,
    importId: string,
    operation: string,
  ): Promise<ImportJobSummary> {
    const summary = await this.get(userId, importId);
    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertImportShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "imports",
      operation,
      firebaseUid: userId,
      operationId: `imports:${operation}:${userId}:${importId}:${Date.now()}`,
      payload: summary,
      write: () => upsertImportShadow(userId, summary),
    });
    return summary;
  }

  private async persistSupabaseImport(
    userId: string,
    summary: ImportJobSummary,
    operation: string,
  ): Promise<ImportJobSummary> {
    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertImportShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "imports",
      operation,
      firebaseUid: userId,
      operationId: `imports:${operation}:${userId}:${summary.importId}:${Date.now()}`,
      payload: summary,
      write: () => upsertImportShadow(userId, summary),
    });
    return summary;
  }

  private async runSupabase(userId: string, importId: string, budget: number): Promise<ImportRunResult> {
    const {
      deleteImportStagedShadow,
      listImportStagedEpisodesShadow,
      listImportStagedShowsShadow,
      upsertImportStagedEpisodeShadow,
      upsertImportStagedShowShadow,
    } = await import("../migration/supabaseWriters");

    const job = await this.get(userId, importId);
    if (job.status !== "staged" && job.status !== "running") {
      throw new HttpError(409, "Import job must be committed before run.", "import_not_ready");
    }

    let current = await this.persistSupabaseImport(userId, {
      ...job,
      status: "running",
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    }, "run:start");

    const stagedShows = (await listImportStagedShowsShadow(importId, false)).slice(0, 50);
    let watchlistImported = 0;
    for (const row of stagedShows) {
      const payload = isRecord(row.payload) ? row.payload : {};
      const mediaType = (row.media_type ?? payload.mediaType) === "movie" ? "movie" : "tv";
      const tmdbId = Number(row.tmdb_id ?? payload.tmdbId);
      await watchlistService.mergeImport(userId, {
        tmdbId,
        mediaType,
        title: String(payload.title ?? `TMDb ${tmdbId}`),
        poster: optionalString(payload.poster),
        backdrop: optionalString(payload.backdrop),
        status: String(payload.status ?? row.status ?? (mediaType === "movie" ? "plan_to_watch" : "plan_to_watch")) as WatchlistStatus,
      });
      await upsertImportStagedShowShadow(importId, {
        mediaType,
        tmdbId,
        status: String(row.status ?? payload.status ?? "pending"),
        payload: {...payload, imported: true},
      });
      watchlistImported += 1;
    }

    const pendingEpisodes = await listImportStagedEpisodesShadow(importId, "pending", budget);
    const byShow = new Map<number, Array<Record<string, unknown>>>();
    for (const row of pendingEpisodes) {
      const payload = isRecord(row.payload) ? row.payload : {};
      const tmdbId = Number(row.show_tmdb_id ?? payload.tmdbId);
      const bucket = byShow.get(tmdbId) ?? [];
      bucket.push(row);
      byShow.set(tmdbId, bucket);
    }

    let processedEpisodes = 0;
    let episodesImported = 0;
    let episodesSkipped = 0;
    let episodesFailed = 0;

    for (const [tmdbId, rows] of byShow) {
      const episodes = rows.map((row) => {
        const payload = isRecord(row.payload) ? row.payload : {};
        return {
          seasonNumber: Number(row.season_number ?? payload.seasonNumber),
          episodeNumber: Number(row.episode_number ?? payload.episodeNumber),
          watchedAt: optionalString(payload.watchedAt),
        };
      });

      try {
        const result = await progressService.importWatchedEpisodes(userId, String(tmdbId), tmdbId, {
          importId,
          source: "tv_time",
          episodes,
        });
        episodesImported += result.imported;
        episodesSkipped += result.skipped;
        episodesFailed += result.failedKeys.length;
        processedEpisodes += rows.length;

        const failed = new Set(result.failedKeys);
        const skipped = new Set(result.skippedKeys);
        for (const row of rows) {
          const payload = isRecord(row.payload) ? row.payload : {};
          const seasonNumber = Number(row.season_number ?? payload.seasonNumber);
          const episodeNumber = Number(row.episode_number ?? payload.episodeNumber);
          const key = episodeKeyFor(seasonNumber, episodeNumber);
          const status: StagedEpisodeStatus = failed.has(key) ? "failed" : skipped.has(key) ? "skipped" : "imported";
          await upsertImportStagedEpisodeShadow(importId, {
            showTmdbId: tmdbId,
            seasonNumber,
            episodeNumber,
            status,
            payload: {
              ...payload,
              status,
              skipReason: failed.has(key) ? "episode_not_found_in_tmdb" : skipped.has(key) ? "already_watched" : null,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import batch failed.";
        episodesFailed += rows.length;
        processedEpisodes += rows.length;
        for (const row of rows) {
          const payload = isRecord(row.payload) ? row.payload : {};
          await upsertImportStagedEpisodeShadow(importId, {
            showTmdbId: tmdbId,
            seasonNumber: Number(row.season_number ?? payload.seasonNumber),
            episodeNumber: Number(row.episode_number ?? payload.episodeNumber),
            status: "failed",
            payload: {...payload, status: "failed", skipReason: message},
          });
        }
      }
    }

    current = {
      ...current,
      watchlistImported: current.watchlistImported + watchlistImported,
      episodesImported: current.episodesImported + episodesImported,
      episodesSkipped: current.episodesSkipped + episodesSkipped,
      episodesFailed: current.episodesFailed + episodesFailed,
      updatedAt: new Date().toISOString(),
    };

    const remainingEpisodes = await listImportStagedEpisodesShadow(importId, "pending", 1);
    const remainingShows = await listImportStagedShowsShadow(importId, false);
    const done = remainingEpisodes.length === 0 && remainingShows.length === 0;

    if (done) {
      const allShows = await listImportStagedShowsShadow(importId, null);
      const allEpisodes = await listImportStagedEpisodesShadow(importId, null, maxReportRows);
      const titleByTmdbId = new Map<number, string>();
      for (const row of allShows) {
        const payload = isRecord(row.payload) ? row.payload : {};
        titleByTmdbId.set(Number(row.tmdb_id ?? payload.tmdbId), String(payload.title ?? ""));
      }
      const mappingRows: ImportReportRow[] = (current.mappingSkippedShows ?? []).map((show) => ({
        kind: "skipped_show",
        title: show.title,
        tmdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        reason: show.reason,
        sourceShowId: show.sourceShowId,
      }));
      const episodeRows: ImportReportRow[] = allEpisodes
        .filter((row) => row.status === "failed" || row.status === "skipped")
        .map((row) => {
          const payload = isRecord(row.payload) ? row.payload : {};
          const tmdbId = Number(row.show_tmdb_id ?? payload.tmdbId);
          const failed = row.status === "failed";
          return {
            kind: failed ? "failed_episode" : "skipped_episode",
            title: titleByTmdbId.get(tmdbId) ?? null,
            tmdbId,
            seasonNumber: Number(row.season_number ?? payload.seasonNumber),
            episodeNumber: Number(row.episode_number ?? payload.episodeNumber),
            reason: String(payload.skipReason ?? (failed ? "failed" : "already_watched")),
            sourceShowId: optionalString(payload.sourceShowId),
          };
        });
      const rows = [...mappingRows, ...episodeRows].slice(0, maxReportRows);
      const now = new Date().toISOString();
      await deleteImportStagedShadow(importId);
      current = {
        ...current,
        status: "completed",
        completedAt: now,
        stagingClearedAt: now,
        stagingDocsDeleted: allShows.length + allEpisodes.length,
        report: {
          generatedAt: now,
          failedEpisodeCount: current.episodesFailed,
          skippedEpisodeCount: current.episodesSkipped,
          skippedShowCount: current.mappingSkippedShows?.length ?? 0,
          truncated: mappingRows.length + episodeRows.length > rows.length,
          rows,
        },
        updatedAt: now,
      };
    }

    current = await this.persistSupabaseImport(userId, current, done ? "completed" : "run");
    return {
      import: current,
      processedEpisodes,
      remainingEpisodes: done ? 0 : Math.max(
        0,
        current.episodesStaged - current.episodesImported - current.episodesSkipped - current.episodesFailed,
      ),
      done,
    };
  }

  async create(userId: string, provider: ImportProvider, sourceHash: string | null): Promise<ImportJobSummary> {
    const {shouldPersistFirestore} = await import("../config/env");
    const persistFirestore = shouldPersistFirestore();
    if (sourceHash && persistFirestore) {
      const existing = await this.collection(userId).where("sourceHash", "==", sourceHash).limit(5).get();
      const reusable = existing.docs.find((doc) => {
        const status = (doc.data() as ImportDocument).status;
        return status === "completed" || status === "running" || status === "staged" || status === "draft";
      });
      if (reusable) {
        return this.mapImport(reusable.id, reusable.data() as ImportDocument);
      }
    }

    const importId = randomUUID();
    const ref = persistFirestore ? this.collection(userId).doc(importId) : null;
    const data: ImportDocument = {
      provider,
      status: "draft",
      sourceHash,
      watchlistStaged: 0,
      episodesStaged: 0,
      watchlistImported: 0,
      episodesImported: 0,
      episodesSkipped: 0,
      episodesFailed: 0,
      errorMessage: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      completedAt: null,
      stagingClearedAt: null,
      stagingDocsDeleted: 0,
      mappingSkippedShows: [],
      report: null,
    };
    if (ref) {
      await ref.set(data);
    }
    const summary = this.mapImport(importId, data);
    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertImportShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "imports",
      operation: "create",
      firebaseUid: userId,
      operationId: `imports:create:${userId}:${importId}`,
      payload: summary,
      write: () => upsertImportShadow(userId, summary),
    });
    return summary;
  }

  async get(userId: string, importId: string): Promise<ImportJobSummary> {
    const {isSupabaseReadImportStaging, shouldPersistFirestore} = await import("../config/env");
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");

    if (isSupabaseReadImportStaging() || !shouldPersistFirestore()) {
      const env = getSupabaseEnvOrNull();
      if (env) {
        const rows = (await supabaseRest(
          env,
          `imports?id=eq.${encodeURIComponent(importId)}` +
            `&firebase_uid=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (row) {
          const summary = (row.summary as Record<string, unknown> | null) ?? {};
          return {
            importId: String(row.id),
            provider: String(row.provider ?? "tv_time") as ImportProvider,
            status: String(row.status ?? "draft") as ImportJobSummary["status"],
            sourceHash: (summary.sourceHash as string | null) ?? null,
            watchlistStaged: Number(summary.watchlistStaged ?? 0),
            episodesStaged: Number(summary.episodesStaged ?? 0),
            watchlistImported: Number(summary.watchlistImported ?? 0),
            episodesImported: Number(summary.episodesImported ?? 0),
            episodesSkipped: Number(summary.episodesSkipped ?? 0),
            episodesFailed: Number(summary.episodesFailed ?? 0),
            errorMessage: (summary.errorMessage as string | null) ?? null,
            createdAt: typeof row.created_at === "string" ? row.created_at : null,
            updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
            completedAt: (summary.completedAt as string | null) ?? null,
            stagingClearedAt: (summary.stagingClearedAt as string | null) ?? null,
            stagingDocsDeleted: Number(summary.stagingDocsDeleted ?? 0),
            report: (summary.report as ImportReport | null) ?? null,
            mappingSkippedShows: Array.isArray(summary.mappingSkippedShows) ?
              summary.mappingSkippedShows as ImportMappingSkippedShow[] : [],
          };
        }
      }
    }

    if (!shouldPersistFirestore()) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }

    const snapshot = await this.collection(userId).doc(importId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }
    return this.mapImport(importId, snapshot.data() as ImportDocument);
  }

  async stageWatchlist(userId: string, importId: string, items: ImportWatchlistItemInput[]): Promise<ImportJobSummary> {
    const {shouldPersistFirestore} = await import("../config/env");
    const ref = shouldPersistFirestore() ? this.collection(userId).doc(importId) : null;
    let status: ImportJobSummary["status"];
    let supabaseJob: ImportJobSummary | null = null;

    if (ref) {
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        throw new HttpError(404, "Import job was not found.", "import_not_found");
      }
      status = (snapshot.data() as ImportDocument).status;
    } else {
      supabaseJob = await this.get(userId, importId);
      status = supabaseJob.status;
    }

    if (status !== "draft" && status !== "staged") {
      throw new HttpError(409, "Import job can no longer accept staging writes.", "import_not_staging");
    }

    if (ref) {
      const batch = getFirestore().batch();
      for (const item of items) {
        const docId = stagedShowDocId(item.mediaType, item.tmdbId);
        batch.set(ref.collection("stagedShows").doc(docId), {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          poster: item.poster ?? null,
          backdrop: item.backdrop ?? null,
          status: item.status,
          sourceShowId: item.sourceShowId ?? null,
          imported: false,
        } satisfies StagedShowDocument);
      }
      batch.set(
        ref,
        {
          status: "draft",
          watchlistStaged: FieldValue.increment(items.length),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      await batch.commit();
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertImportStagedShowShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "importStaging",
      operation: "stageWatchlist",
      firebaseUid: userId,
      operationId: `importStaging:show:${userId}:${importId}:${Date.now()}`,
      payload: {importId, count: items.length},
      write: async () => {
        for (const item of items) {
          await upsertImportStagedShowShadow(importId, {
            mediaType: item.mediaType,
            tmdbId: item.tmdbId,
            status: item.status,
            payload: {
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title,
              poster: item.poster ?? null,
              backdrop: item.backdrop ?? null,
              status: item.status,
              sourceShowId: item.sourceShowId ?? null,
              imported: false,
            },
          });
        }
      },
    });

    if (supabaseJob) {
      return this.persistSupabaseImport(userId, {
        ...supabaseJob,
        status: "draft",
        watchlistStaged: supabaseJob.watchlistStaged + items.length,
        updatedAt: new Date().toISOString(),
      }, "stageWatchlist");
    }

    return this.shadowImportJob(userId, importId, "stageWatchlist");
  }

  async stageEpisodes(userId: string, importId: string, episodes: ImportEpisodeInput[]): Promise<ImportJobSummary> {
    const {shouldPersistFirestore} = await import("../config/env");
    const ref = shouldPersistFirestore() ? this.collection(userId).doc(importId) : null;
    let status: ImportJobSummary["status"];
    let supabaseJob: ImportJobSummary | null = null;

    if (ref) {
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        throw new HttpError(404, "Import job was not found.", "import_not_found");
      }
      status = (snapshot.data() as ImportDocument).status;
    } else {
      supabaseJob = await this.get(userId, importId);
      status = supabaseJob.status;
    }

    if (status !== "draft" && status !== "staged") {
      throw new HttpError(409, "Import job can no longer accept staging writes.", "import_not_staging");
    }

    if (ref) {
      const batch = getFirestore().batch();
      for (const episode of episodes) {
        const docId = stagedEpisodeDocId(episode.tmdbId, episode.seasonNumber, episode.episodeNumber);
        batch.set(ref.collection("stagedEpisodes").doc(docId), {
          tmdbId: episode.tmdbId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          watchedAt: episode.watchedAt ?? null,
          sourceShowId: episode.sourceShowId ?? null,
          sourceEpisodeId: episode.sourceEpisodeId ?? null,
          bulkType: episode.bulkType ?? null,
          status: "pending",
          skipReason: null,
        } satisfies StagedEpisodeDocument);
      }
      batch.set(
        ref,
        {
          status: "draft",
          episodesStaged: FieldValue.increment(episodes.length),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      await batch.commit();
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertImportStagedEpisodeShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "importStaging",
      operation: "stageEpisodes",
      firebaseUid: userId,
      operationId: `importStaging:episode:${userId}:${importId}:${Date.now()}`,
      payload: {importId, count: episodes.length},
      write: async () => {
        for (const episode of episodes) {
          await upsertImportStagedEpisodeShadow(importId, {
            showTmdbId: episode.tmdbId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            status: "pending",
            payload: {
              tmdbId: episode.tmdbId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              watchedAt: episode.watchedAt ?? null,
              sourceShowId: episode.sourceShowId ?? null,
              sourceEpisodeId: episode.sourceEpisodeId ?? null,
              bulkType: episode.bulkType ?? null,
              status: "pending",
              skipReason: null,
            },
          });
        }
      },
    });

    if (supabaseJob) {
      return this.persistSupabaseImport(userId, {
        ...supabaseJob,
        status: "draft",
        episodesStaged: supabaseJob.episodesStaged + episodes.length,
        updatedAt: new Date().toISOString(),
      }, "stageEpisodes");
    }

    return this.shadowImportJob(userId, importId, "stageEpisodes");
  }

  async commit(
    userId: string,
    importId: string,
    skippedShows: ImportMappingSkippedShow[] = [],
  ): Promise<ImportJobSummary> {
    const {shouldPersistFirestore} = await import("../config/env");
    if (!shouldPersistFirestore()) {
      const job = await this.get(userId, importId);
      if (job.status !== "draft" && job.status !== "staged") {
        throw new HttpError(409, "Import job is not ready to commit.", "import_not_staging");
      }
      if (job.watchlistStaged === 0 && job.episodesStaged === 0) {
        throw new HttpError(400, "Stage at least one watchlist or episode row before commit.", "import_empty");
      }
      return this.persistSupabaseImport(userId, {
        ...job,
        status: "staged",
        mappingSkippedShows: skippedShows,
        updatedAt: new Date().toISOString(),
      }, "commit");
    }

    const ref = this.collection(userId).doc(importId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }

    const job = snapshot.data() as ImportDocument;
    if (job.status !== "draft" && job.status !== "staged") {
      throw new HttpError(409, "Import job is not ready to commit.", "import_not_staging");
    }

    if ((job.watchlistStaged ?? 0) === 0 && (job.episodesStaged ?? 0) === 0) {
      throw new HttpError(400, "Stage at least one watchlist or episode row before commit.", "import_empty");
    }

    await ref.set(
      {
        status: "staged",
        mappingSkippedShows: skippedShows,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    return this.shadowImportJob(userId, importId, "commit");
  }

  async run(userId: string, importId: string, maxEpisodeWrites = maxRunEpisodeWrites): Promise<ImportRunResult> {
    const budget = Math.min(Math.max(maxEpisodeWrites, 1), maxRunEpisodeWrites);
    const {shouldPersistFirestore} = await import("../config/env");
    if (!shouldPersistFirestore()) {
      return this.runSupabase(userId, importId, budget);
    }
    const ref = this.collection(userId).doc(importId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }

    const job = snapshot.data() as ImportDocument;
    if (job.status !== "staged" && job.status !== "running") {
      throw new HttpError(409, "Import job must be committed before run.", "import_not_ready");
    }

    await ref.set({status: "running", updatedAt: FieldValue.serverTimestamp(), errorMessage: null}, {merge: true});

    const showsSnapshot = await ref.collection("stagedShows").where("imported", "==", false).limit(50).get();
    let watchlistImported = 0;
    for (const showDoc of showsSnapshot.docs) {
      const show = showDoc.data() as StagedShowDocument;
      await watchlistService.mergeImport(userId, {
        tmdbId: show.tmdbId,
        mediaType: show.mediaType,
        title: show.title,
        poster: show.poster ?? null,
        backdrop: show.backdrop ?? null,
        status: show.status,
      });
      await showDoc.ref.set({imported: true}, {merge: true});
      watchlistImported += 1;
    }

    const pendingSnapshot = await ref
      .collection("stagedEpisodes")
      .where("status", "==", "pending")
      .limit(budget)
      .get();

    const byShow = new Map<number, QueryDocumentSnapshot[]>();
    for (const doc of pendingSnapshot.docs) {
      const data = doc.data() as StagedEpisodeDocument;
      const bucket = byShow.get(data.tmdbId) ?? [];
      bucket.push(doc);
      byShow.set(data.tmdbId, bucket);
    }

    let processedEpisodes = 0;
    let episodesImported = 0;
    let episodesSkipped = 0;
    let episodesFailed = 0;

    for (const [tmdbId, docs] of byShow) {
      const chunk = docs.slice(0, maxRunEpisodeWrites);
      const episodes = chunk.map((doc) => {
        const data = doc.data() as StagedEpisodeDocument;
        return {
          seasonNumber: data.seasonNumber,
          episodeNumber: data.episodeNumber,
          watchedAt: data.watchedAt ?? null,
        };
      });

      try {
        const result = await progressService.importWatchedEpisodes(userId, String(tmdbId), tmdbId, {
          importId,
          source: "tv_time",
          episodes,
        });
        episodesImported += result.imported;
        episodesSkipped += result.skipped;
        episodesFailed += result.failedKeys.length;
        processedEpisodes += chunk.length;

        const failed = new Set(result.failedKeys);
        const skipped = new Set(result.skippedKeys);
        const statusBatch = getFirestore().batch();
        for (const doc of chunk) {
          const data = doc.data() as StagedEpisodeDocument;
          const key = episodeKeyFor(data.seasonNumber, data.episodeNumber);
          if (failed.has(key)) {
            statusBatch.set(
              doc.ref,
              {status: "failed", skipReason: "episode_not_found_in_tmdb"},
              {merge: true},
            );
          } else if (skipped.has(key)) {
            statusBatch.set(
              doc.ref,
              {status: "skipped", skipReason: "already_watched"},
              {merge: true},
            );
          } else {
            statusBatch.set(doc.ref, {status: "imported", skipReason: null}, {merge: true});
          }
        }
        await statusBatch.commit();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import batch failed.";
        const statusBatch = getFirestore().batch();
        for (const doc of chunk) {
          statusBatch.set(doc.ref, {status: "failed", skipReason: message}, {merge: true});
        }
        await statusBatch.commit();
        episodesFailed += chunk.length;
        processedEpisodes += chunk.length;
      }
    }

    await ref.set(
      {
        watchlistImported: FieldValue.increment(watchlistImported),
        episodesImported: FieldValue.increment(episodesImported),
        episodesSkipped: FieldValue.increment(episodesSkipped),
        episodesFailed: FieldValue.increment(episodesFailed),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    const remainingSnapshot = await ref.collection("stagedEpisodes").where("status", "==", "pending").limit(1).get();
    const remainingShows = await ref.collection("stagedShows").where("imported", "==", false).limit(1).get();
    const done = remainingSnapshot.empty && remainingShows.empty;

    if (done) {
      const latestSnapshot = await ref.get();
      const latestJob = (latestSnapshot.data() as ImportDocument | undefined) ?? job;
      const report = await this.buildImportReport(userId, importId, latestJob);
      const stagingDocsDeleted = await this.clearStaging(userId, importId);
      await ref.set(
        {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          stagingClearedAt: FieldValue.serverTimestamp(),
          stagingDocsDeleted,
          report,
        },
        {merge: true},
      );
    }

    const summary = await this.shadowImportJob(userId, importId, done ? "completed" : "run");
    const remainingEstimate = done
      ? 0
      : Math.max(0, summary.episodesStaged - summary.episodesImported - summary.episodesSkipped - summary.episodesFailed);

    return {
      import: summary,
      processedEpisodes,
      remainingEpisodes: remainingEstimate,
      done,
    };
  }
}

export const importService = new ImportService();

export const hashImportPayload = (watchlistCount: number, episodeCount: number, fingerprint: string) =>
  createHash("sha256").update(`${fingerprint}:${watchlistCount}:${episodeCount}`).digest("hex");
