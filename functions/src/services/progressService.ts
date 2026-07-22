import {DocumentReference, DocumentSnapshot, FieldValue, Timestamp, Transaction, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {
  BatchEpisodeProgressInput,
  EpisodeProgress,
  ImportEpisodesInput,
  MarkEpisodeWatchedInput,
  ProgressEpisodePointer,
  ShowProgress,
  ShowProgressSummary,
} from "../models/progress";
import {parseImportWatchedAt, pickEarliestWatchedAt} from "./importLogic";
import {MediaDetail, TvSeasonDetail} from "../models/media";
import {
  compareEpisodeCoordinates,
  episodeKeyFor,
  findNextUnwatchedEpisode,
  progressPercentFor,
  toEpisodePointer,
} from "./progressLogic";
import {tmdbService} from "./tmdbService";
import {mapInChunks, needsImageUrl, normalizeImageUrl, preferImageUrl} from "./watchlistPosterLogic";
import {watchlistService} from "./watchlistService";
import {derivedCacheService} from "./derivedCacheService";

interface ProgressDocument {
  tmdbId: number;
  title: string;
  poster?: string | null;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  nextEpisode?: ProgressEpisodePointer | null;
  watchedEpisodeKeys?: string[];
  updatedAt?: Timestamp;
}

interface EpisodeProgressDocument {
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  watched: boolean;
  watchedAt?: Timestamp;
  updatedAt?: Timestamp;
  source?: string | null;
  sourceImportId?: string | null;
}

interface CanonicalProgressMetadata {
  tvDetail: MediaDetail;
  seasons: TvSeasonDetail[];
  episodesByKey: Map<string, ProgressEpisodePointer>;
  totalEpisodes: number;
}

const maxBatchEpisodeCount = 100;
const POSTER_BACKFILL_CONCURRENCY = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown, field: string) => {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, "invalid_progress_payload");
  }

  return numberValue;
};

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const mapEpisodeDocument = (episodeKey: string, data: EpisodeProgressDocument): EpisodeProgress => ({
  episodeKey,
  seasonNumber: data.seasonNumber,
  episodeNumber: data.episodeNumber,
  episodeTitle: data.episodeTitle,
  watched: data.watched,
  watchedAt: timestampToJson(data.watchedAt),
  updatedAt: timestampToJson(data.updatedAt),
});

export const parseShowId = (value: string) => {
  const tmdbId = Number(value);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new HttpError(400, "Show id must be a positive TMDb id.", "invalid_show_id");
  }

  return {
    showId: String(tmdbId),
    tmdbId,
  };
};

export const parseEpisodeProgressInput = (body: unknown): MarkEpisodeWatchedInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_progress_payload");
  }

  return {
    seasonNumber: positiveInteger(body.seasonNumber, "seasonNumber"),
    episodeNumber: positiveInteger(body.episodeNumber, "episodeNumber"),
  };
};

export const parseBatchEpisodeProgressInput = (body: unknown): BatchEpisodeProgressInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_progress_payload");
  }

  if (typeof body.watched !== "boolean") {
    throw new HttpError(400, "watched must be a boolean.", "invalid_progress_payload");
  }

  if (!Array.isArray(body.episodes) || body.episodes.length === 0) {
    throw new HttpError(400, "episodes must be a non-empty array.", "invalid_progress_payload");
  }

  if (body.episodes.length > maxBatchEpisodeCount) {
    throw new HttpError(400, `episodes cannot contain more than ${maxBatchEpisodeCount} items.`, "batch_too_large");
  }

  const uniqueEpisodes = new Map<string, MarkEpisodeWatchedInput>();
  for (const episode of body.episodes) {
    const parsed = parseEpisodeProgressInput(episode);
    uniqueEpisodes.set(episodeKeyFor(parsed.seasonNumber, parsed.episodeNumber), parsed);
  }

  return {
    watched: body.watched,
    episodes: [...uniqueEpisodes.values()],
  };
};

class ProgressService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("progress");
  }

  private historyCollection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("history");
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<ShowProgressSummary>> {
    const baseQuery = this.collection(userId).orderBy("updatedAt", "desc");

    return listPaginated(baseQuery, pagination, (doc) =>
      this.mapProgressSummary(doc.id, doc.data() as ProgressDocument),
    );
  }

  /**
   * Fill missing progress posters from TMDb and persist them.
   * Does not bump updatedAt so list order stays stable.
   */
  async backfillMissingPosters(
    userId: string,
    items: ShowProgressSummary[],
  ): Promise<ShowProgressSummary[]> {
    const missing = items.filter((item) => needsImageUrl(item.poster));
    if (missing.length === 0) {
      return items;
    }

    const updates = await mapInChunks(missing, POSTER_BACKFILL_CONCURRENCY, async (item) => {
      try {
        const detail = await tmdbService.tvDetail(item.tmdbId);
        const poster = normalizeImageUrl(detail.images.poster);
        if (!poster || poster === item.poster) {
          return item;
        }

        await this.collection(userId).doc(item.showId).update({poster});
        return {...item, poster};
      } catch {
        return item;
      }
    });

    const byId = new Map(updates.map((item) => [item.showId, item]));
    return items.map((item) => byId.get(item.showId) ?? item);
  }

  async get(userId: string, showId: string): Promise<ShowProgress | null> {
    const progressRef = this.collection(userId).doc(showId);
    const progressSnapshot = await progressRef.get();

    if (!progressSnapshot.exists) {
      return null;
    }

    const data = progressSnapshot.data() as ProgressDocument;
    const episodes = await this.loadEpisodeDocuments(progressRef, data.watchedEpisodeKeys);

    return this.mapProgress(showId, data, episodes);
  }

  private async loadEpisodeDocuments(
    progressRef: DocumentReference,
    watchedEpisodeKeys: string[] | undefined,
  ): Promise<EpisodeProgress[]> {
    if (Array.isArray(watchedEpisodeKeys)) {
      if (watchedEpisodeKeys.length === 0) {
        return [];
      }
      const firestore = getFirestore();
      const episodes: EpisodeProgress[] = [];
      for (let index = 0; index < watchedEpisodeKeys.length; index += 100) {
        const chunk = watchedEpisodeKeys.slice(index, index + 100);
        const snapshots = await firestore.getAll(
          ...chunk.map((episodeKey) => progressRef.collection("episodes").doc(episodeKey)),
        );
        for (const snapshot of snapshots) {
          if (snapshot.exists) {
            episodes.push(mapEpisodeDocument(snapshot.id, snapshot.data() as EpisodeProgressDocument));
          }
        }
      }
      return episodes;
    }

    const episodesSnapshot = await progressRef.collection("episodes").get();
    return episodesSnapshot.docs.map((doc) =>
      mapEpisodeDocument(doc.id, doc.data() as EpisodeProgressDocument),
    );
  }

  private async resolveWatchedEpisodeKeys(
    transaction: Transaction,
    progressRef: DocumentReference,
    existingProgressSnapshot: DocumentSnapshot,
  ): Promise<Set<string>> {
    const data = existingProgressSnapshot.exists
      ? (existingProgressSnapshot.data() as ProgressDocument)
      : undefined;
    if (Array.isArray(data?.watchedEpisodeKeys)) {
      return new Set(data.watchedEpisodeKeys);
    }

    const existingEpisodesSnapshot = await transaction.get(progressRef.collection("episodes"));
    return new Set(existingEpisodesSnapshot.docs.map((doc) => doc.id));
  }

  async markWatched(userId: string, showId: string, tmdbId: number, input: MarkEpisodeWatchedInput): Promise<ShowProgress> {
    return this.updateEpisodes(userId, showId, tmdbId, {
      watched: true,
      episodes: [input],
    });
  }

  async markUnwatched(
    userId: string,
    showId: string,
    tmdbId: number,
    input: MarkEpisodeWatchedInput,
  ): Promise<ShowProgress> {
    return this.updateEpisodes(userId, showId, tmdbId, {
      watched: false,
      episodes: [input],
    });
  }

  async updateEpisodes(
    userId: string,
    showId: string,
    tmdbId: number,
    input: BatchEpisodeProgressInput,
  ): Promise<ShowProgress> {
    const canonical = await this.loadCanonicalMetadata(tmdbId);
    const requested = input.episodes.map((episode) => {
      const episodeKey = episodeKeyFor(episode.seasonNumber, episode.episodeNumber);
      const metadata = canonical.episodesByKey.get(episodeKey);

      if (!metadata) {
        throw new HttpError(404, "Episode was not found for this show.", "episode_not_found");
      }

      return metadata;
    });

    const progressRef = this.collection(userId).doc(showId);
    const historyCollection = this.historyCollection(userId);

    await getFirestore().runTransaction(async (transaction) => {
      const existingProgressSnapshot = await transaction.get(progressRef);
      const finalEpisodeKeys = await this.resolveWatchedEpisodeKeys(
        transaction,
        progressRef,
        existingProgressSnapshot,
      );
      const existingPoster = existingProgressSnapshot.exists
        ? (existingProgressSnapshot.data() as ProgressDocument | undefined)?.poster
        : null;

      const requestedRefs = requested.map((episode) =>
        progressRef.collection("episodes").doc(episode.episodeKey),
      );
      const requestedSnapshots =
        requestedRefs.length > 0 ? await Promise.all(requestedRefs.map((ref) => transaction.get(ref))) : [];
      const existingEpisodesByKey = new Map(
        requestedSnapshots
          .filter((snapshot) => snapshot.exists)
          .map((snapshot) => [snapshot.id, snapshot] as const),
      );

      for (const episode of requested) {
        const episodeRef = progressRef.collection("episodes").doc(episode.episodeKey);
        const historyRef = historyCollection.doc(`tv_${tmdbId}_${episode.episodeKey}`);

        if (input.watched) {
          const existing = existingEpisodesByKey.get(episode.episodeKey);
          const wasAlreadyWatched = Boolean(existing);
          finalEpisodeKeys.add(episode.episodeKey);
          transaction.set(
            episodeRef,
            {
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeTitle: episode.episodeTitle,
              watched: true,
              watchedAt: existing?.get("watchedAt") ?? FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          );
          const seasonEpisode = canonical.seasons
            .flatMap((season) => season.episodes)
            .find(
              (candidate) =>
                candidate.seasonNumber === episode.seasonNumber &&
                candidate.episodeNumber === episode.episodeNumber,
            );
          transaction.set(
            historyRef,
            {
              tmdbId,
              mediaType: "tv",
              title: canonical.tvDetail.title,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeTitle: episode.episodeTitle,
              watchedAt: existing?.get("watchedAt") ?? FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              rewatchCount: wasAlreadyWatched ? FieldValue.increment(1) : 0,
              genreNames: canonical.tvDetail.genres.map((genre) => genre.name),
              runtimeMinutes:
                seasonEpisode?.runtimeMinutes ?? canonical.tvDetail.runtimeMinutes ?? null,
            },
            {merge: true},
          );
        } else {
          finalEpisodeKeys.delete(episode.episodeKey);
          transaction.delete(episodeRef);
          transaction.delete(historyRef);
        }
      }

      const watchedEpisodeKeys = [...finalEpisodeKeys].sort();
      const finalEpisodes = watchedEpisodeKeys
        .map((episodeKey) => canonical.episodesByKey.get(episodeKey))
        .filter((episode): episode is ProgressEpisodePointer => episode !== undefined)
        .sort(compareEpisodeCoordinates);
      const highestWatchedEpisode = finalEpisodes[finalEpisodes.length - 1] ?? null;
      const nextEpisode = findNextUnwatchedEpisode(canonical.seasons, finalEpisodeKeys);

      transaction.set(
        progressRef,
        {
          tmdbId,
          title: canonical.tvDetail.title,
          poster: preferImageUrl(existingPoster, canonical.tvDetail.images.poster),
          totalEpisodes: canonical.totalEpisodes,
          watchedEpisodeCount: finalEpisodes.length,
          progressPercent: progressPercentFor(finalEpisodes.length, canonical.totalEpisodes),
          currentSeason: highestWatchedEpisode?.seasonNumber ?? null,
          currentEpisode: highestWatchedEpisode?.episodeNumber ?? null,
          nextEpisode,
          watchedEpisodeKeys,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    const progress = await this.get(userId, showId);
    if (!progress) {
      throw new HttpError(500, "Progress could not be read after update.", "progress_update_failed");
    }

    await watchlistService.syncTvStatusFromProgress(userId, tmdbId, progress);
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    return progress;
  }

  /**
   * Import-only OR-merge of watched episodes. Preserves historical watchedAt,
   * never unwatches, and does not treat re-import as a rewatch.
   */
  async importWatchedEpisodes(
    userId: string,
    showId: string,
    tmdbId: number,
    input: ImportEpisodesInput,
  ): Promise<{imported: number; skipped: number; failedKeys: string[]}> {
    if (input.episodes.length === 0) {
      return {imported: 0, skipped: 0, failedKeys: []};
    }

    if (input.episodes.length > maxBatchEpisodeCount) {
      throw new HttpError(400, `episodes cannot contain more than ${maxBatchEpisodeCount} items.`, "batch_too_large");
    }

    const canonical = await this.loadCanonicalMetadata(tmdbId);
    const failedKeys: string[] = [];
    const requested = input.episodes.flatMap((episode) => {
      const episodeKey = episodeKeyFor(episode.seasonNumber, episode.episodeNumber);
      const metadata = canonical.episodesByKey.get(episodeKey);
      if (!metadata) {
        failedKeys.push(episodeKey);
        return [];
      }

      return [{
        metadata,
        watchedAt: parseImportWatchedAt(episode.watchedAt),
      }];
    });

    if (requested.length === 0) {
      return {imported: 0, skipped: 0, failedKeys};
    }

    const progressRef = this.collection(userId).doc(showId);
    const historyCollection = this.historyCollection(userId);
    let imported = 0;
    let skipped = 0;
    const now = new Date();

    await getFirestore().runTransaction(async (transaction) => {
      const existingProgressSnapshot = await transaction.get(progressRef);
      const finalEpisodeKeys = await this.resolveWatchedEpisodeKeys(
        transaction,
        progressRef,
        existingProgressSnapshot,
      );
      const existingPoster = existingProgressSnapshot.exists
        ? (existingProgressSnapshot.data() as ProgressDocument | undefined)?.poster
        : null;

      const requestedRefs = requested.map(({metadata}) =>
        progressRef.collection("episodes").doc(metadata.episodeKey),
      );
      const requestedSnapshots =
        requestedRefs.length > 0 ? await Promise.all(requestedRefs.map((ref) => transaction.get(ref))) : [];
      const existingEpisodesByKey = new Map(
        requestedSnapshots
          .filter((snapshot) => snapshot.exists)
          .map((snapshot) => [snapshot.id, snapshot] as const),
      );

      for (const {metadata: episode, watchedAt: incomingWatchedAt} of requested) {
        const episodeRef = progressRef.collection("episodes").doc(episode.episodeKey);
        const historyRef = historyCollection.doc(`tv_${tmdbId}_${episode.episodeKey}`);
        const existing = existingEpisodesByKey.get(episode.episodeKey);
        const existingWatchedAt = existing?.get("watchedAt") as Timestamp | undefined;
        const earliest = pickEarliestWatchedAt(
          existingWatchedAt?.toDate() ?? null,
          incomingWatchedAt,
          now,
        );

        if (existing) {
          skipped += 1;
          transaction.set(
            episodeRef,
            {
              watchedAt: Timestamp.fromDate(earliest),
              updatedAt: FieldValue.serverTimestamp(),
              source: existing.get("source") ?? input.source ?? "tv_time",
              sourceImportId: existing.get("sourceImportId") ?? input.importId,
            },
            {merge: true},
          );
          transaction.set(
            historyRef,
            {
              watchedAt: Timestamp.fromDate(earliest),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          );
          continue;
        }

        imported += 1;
        finalEpisodeKeys.add(episode.episodeKey);
        const seasonEpisode = canonical.seasons
          .flatMap((season) => season.episodes)
          .find(
            (candidate) =>
              candidate.seasonNumber === episode.seasonNumber &&
              candidate.episodeNumber === episode.episodeNumber,
          );

        transaction.set(episodeRef, {
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.episodeTitle,
          watched: true,
          watchedAt: Timestamp.fromDate(earliest),
          updatedAt: FieldValue.serverTimestamp(),
          source: input.source ?? "tv_time",
          sourceImportId: input.importId,
        });
        transaction.set(historyRef, {
          tmdbId,
          mediaType: "tv",
          title: canonical.tvDetail.title,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.episodeTitle,
          watchedAt: Timestamp.fromDate(earliest),
          updatedAt: FieldValue.serverTimestamp(),
          rewatchCount: 0,
          genreNames: canonical.tvDetail.genres.map((genre) => genre.name),
          runtimeMinutes:
            seasonEpisode?.runtimeMinutes ?? canonical.tvDetail.runtimeMinutes ?? null,
        });
      }

      const watchedEpisodeKeys = [...finalEpisodeKeys].sort();
      const finalEpisodes = watchedEpisodeKeys
        .map((episodeKey) => canonical.episodesByKey.get(episodeKey))
        .filter((episode): episode is ProgressEpisodePointer => episode !== undefined)
        .sort(compareEpisodeCoordinates);
      const highestWatchedEpisode = finalEpisodes[finalEpisodes.length - 1] ?? null;
      const nextEpisode = findNextUnwatchedEpisode(canonical.seasons, finalEpisodeKeys);

      transaction.set(
        progressRef,
        {
          tmdbId,
          title: canonical.tvDetail.title,
          poster: preferImageUrl(existingPoster, canonical.tvDetail.images.poster),
          totalEpisodes: canonical.totalEpisodes,
          watchedEpisodeCount: finalEpisodes.length,
          progressPercent: progressPercentFor(finalEpisodes.length, canonical.totalEpisodes),
          currentSeason: highestWatchedEpisode?.seasonNumber ?? null,
          currentEpisode: highestWatchedEpisode?.episodeNumber ?? null,
          nextEpisode,
          watchedEpisodeKeys,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    const progress = await this.get(userId, showId);
    if (progress) {
      await watchlistService.syncTvStatusFromProgress(userId, tmdbId, progress);
    }

    await derivedCacheService.invalidateUserLibraryCaches(userId);
    return {imported, skipped, failedKeys};
  }

  private async loadCanonicalMetadata(tmdbId: number): Promise<CanonicalProgressMetadata> {
    const tvDetail = await tmdbService.tvDetail(tmdbId);

    if (tvDetail.mediaType !== "tv") {
      throw new HttpError(400, "Progress can only be tracked for TV shows.", "invalid_media_type");
    }

    const seasonSummaries = (tvDetail.seasons ?? []).filter((season) => season.seasonNumber > 0);
    const seasons = await Promise.all(
      seasonSummaries.map((season) => tmdbService.tvSeasonDetail(tmdbId, season.seasonNumber)),
    );
    const episodesByKey = new Map<string, ProgressEpisodePointer>();

    for (const season of seasons) {
      for (const episode of season.episodes) {
        episodesByKey.set(episode.episodeKey, toEpisodePointer(episode));
      }
    }

    return {
      tvDetail,
      seasons,
      episodesByKey,
      totalEpisodes: tvDetail.totalEpisodes ?? episodesByKey.size,
    };
  }

  private mapProgressSummary(showId: string, data: ProgressDocument): ShowProgressSummary {
    return {
      showId,
      tmdbId: data.tmdbId,
      title: data.title,
      poster: normalizeImageUrl(data.poster),
      totalEpisodes: data.totalEpisodes,
      watchedEpisodeCount: data.watchedEpisodeCount,
      progressPercent: data.progressPercent,
      currentSeason: data.currentSeason,
      currentEpisode: data.currentEpisode,
      nextEpisode: data.nextEpisode ?? null,
      updatedAt: timestampToJson(data.updatedAt),
    };
  }

  private mapProgress(showId: string, data: ProgressDocument, episodes: EpisodeProgress[]): ShowProgress {
    const sortedEpisodes = [...episodes].sort(compareEpisodeCoordinates);

    return {
      ...this.mapProgressSummary(showId, data),
      episodes: sortedEpisodes,
    };
  }
}

export const progressService = new ProgressService();
