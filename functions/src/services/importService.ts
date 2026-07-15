import {createHash, randomUUID} from "node:crypto";
import {FieldValue, QueryDocumentSnapshot, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {
  ImportEpisodeInput,
  ImportJobSummary,
  ImportProvider,
  ImportRunResult,
  ImportStatus,
  ImportWatchlistItemInput,
  StagedEpisodeStatus,
  importProviders,
} from "../models/import";
import {WatchlistStatus, movieWatchlistStatuses, tvWatchlistStatuses} from "../models/watchlist";
import {stagedEpisodeDocId, stagedShowDocId} from "./importLogic";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

const maxStageChunk = 200;
const maxRunEpisodeWrites = 100;

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
    };
  }

  async create(userId: string, provider: ImportProvider, sourceHash: string | null): Promise<ImportJobSummary> {
    if (sourceHash) {
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
    const ref = this.collection(userId).doc(importId);
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
    };
    await ref.set(data);
    return this.mapImport(importId, data);
  }

  async get(userId: string, importId: string): Promise<ImportJobSummary> {
    const snapshot = await this.collection(userId).doc(importId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }
    return this.mapImport(importId, snapshot.data() as ImportDocument);
  }

  async stageWatchlist(userId: string, importId: string, items: ImportWatchlistItemInput[]): Promise<ImportJobSummary> {
    const ref = this.collection(userId).doc(importId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }

    const job = snapshot.data() as ImportDocument;
    if (job.status !== "draft" && job.status !== "staged") {
      throw new HttpError(409, "Import job can no longer accept staging writes.", "import_not_staging");
    }

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
    return this.get(userId, importId);
  }

  async stageEpisodes(userId: string, importId: string, episodes: ImportEpisodeInput[]): Promise<ImportJobSummary> {
    const ref = this.collection(userId).doc(importId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Import job was not found.", "import_not_found");
    }

    const job = snapshot.data() as ImportDocument;
    if (job.status !== "draft" && job.status !== "staged") {
      throw new HttpError(409, "Import job can no longer accept staging writes.", "import_not_staging");
    }

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
    return this.get(userId, importId);
  }

  async commit(userId: string, importId: string): Promise<ImportJobSummary> {
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
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    return this.get(userId, importId);
  }

  async run(userId: string, importId: string, maxEpisodeWrites = maxRunEpisodeWrites): Promise<ImportRunResult> {
    const budget = Math.min(Math.max(maxEpisodeWrites, 1), maxRunEpisodeWrites);
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
        const statusBatch = getFirestore().batch();
        for (const doc of chunk) {
          const data = doc.data() as StagedEpisodeDocument;
          const key = `s${String(data.seasonNumber).padStart(2, "0")}e${String(data.episodeNumber).padStart(2, "0")}`;
          // progressLogic episodeKeyFor uses the same zero-padded form.
          if (failed.has(key)) {
            statusBatch.set(
              doc.ref,
              {status: "failed", skipReason: "episode_not_found_in_tmdb"},
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
      await ref.set(
        {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }

    const summary = await this.get(userId, importId);
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
