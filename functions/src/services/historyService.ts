import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {MediaType} from "../models/media";
import {HistoryEntry, UpdateHistoryInput} from "../models/history";
import {episodeKeyFor} from "./progressLogic";
import {derivedCacheService} from "./derivedCacheService";

interface HistoryDocument {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  watchedAt?: Timestamp;
  updatedAt?: Timestamp;
  rewatchCount?: number;
  genreNames?: string[];
  runtimeMinutes?: number | null;
}

interface MovieHistoryInput {
  tmdbId: number;
  title: string;
  genreNames?: string[];
  runtimeMinutes?: number | null;
}

interface EpisodeHistoryInput {
  tmdbId: number;
  title: string;
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  genreNames?: string[];
  runtimeMinutes?: number | null;
}

const EXISTS_CHUNK_SIZE = 100;

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

export const historyIdForMovie = (tmdbId: number) => `movie_${tmdbId}`;

export const historyIdForEpisode = (tmdbId: number, seasonNumber: number, episodeNumber: number) =>
  `tv_${tmdbId}_${episodeKeyFor(seasonNumber, episodeNumber)}`;

export const historyIdForCoords = (input: {
  mediaType: "movie" | "tv";
  tmdbId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
}): string | null => {
  if (input.mediaType === "movie") {
    return historyIdForMovie(input.tmdbId);
  }
  if (input.seasonNumber == null || input.episodeNumber == null) {
    return null;
  }
  return historyIdForEpisode(input.tmdbId, input.seasonNumber, input.episodeNumber);
};

export const mapHistoryDocument = (historyId: string, data: HistoryDocument): HistoryEntry => ({
  historyId,
  tmdbId: data.tmdbId,
  mediaType: data.mediaType,
  title: data.title,
  seasonNumber: data.seasonNumber,
  episodeNumber: data.episodeNumber,
  episodeTitle: data.episodeTitle,
  watchedAt: timestampToJson(data.watchedAt),
  updatedAt: timestampToJson(data.updatedAt),
  rewatchCount: typeof data.rewatchCount === "number" && data.rewatchCount > 0 ? data.rewatchCount : 0,
  genreNames: Array.isArray(data.genreNames)
    ? data.genreNames.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [],
  runtimeMinutes:
    typeof data.runtimeMinutes === "number" && data.runtimeMinutes > 0 ? data.runtimeMinutes : null,
});

export const parseHistoryWatchedAt = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "watchedAt must be an ISO date string.", "invalid_history_watched_at");
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "watchedAt must be a valid ISO date string.", "invalid_history_watched_at");
  }

  return new Date(parsed);
};

export const parseUpdateHistoryInput = (body: unknown): UpdateHistoryInput => {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body must be an object.", "invalid_history_body");
  }

  const watchedAt = parseHistoryWatchedAt((body as {watchedAt?: unknown}).watchedAt);
  return {watchedAt: watchedAt.toISOString()};
};

class HistoryService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("history");
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<HistoryEntry>> {
    const baseQuery = this.collection(userId).orderBy("watchedAt", "desc");

    return listPaginated(
      baseQuery,
      pagination,
      (doc) => mapHistoryDocument(doc.id, doc.data() as HistoryDocument),
      "watchedAt",
    );
  }

  async listRecent(userId: string, options: {since: Date; limit: number}): Promise<HistoryEntry[]> {
    const snapshot = await this.collection(userId)
      .where("watchedAt", ">=", Timestamp.fromDate(options.since))
      .orderBy("watchedAt", "desc")
      .limit(options.limit)
      .get();

    return snapshot.docs.map((doc) => mapHistoryDocument(doc.id, doc.data() as HistoryDocument));
  }

  async existsMany(userId: string, historyIds: string[]): Promise<Set<string>> {
    const uniqueIds = [...new Set(historyIds.filter(Boolean))];
    const existing = new Set<string>();
    if (uniqueIds.length === 0) {
      return existing;
    }

    const firestore = getFirestore();
    const collection = this.collection(userId);

    for (let index = 0; index < uniqueIds.length; index += EXISTS_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(index, index + EXISTS_CHUNK_SIZE);
      const refs = chunk.map((historyId) => collection.doc(historyId));
      const snapshots = await firestore.getAll(...refs);
      for (const snapshot of snapshots) {
        if (snapshot.exists) {
          existing.add(snapshot.id);
        }
      }
    }

    return existing;
  }

  async get(userId: string, historyId: string): Promise<HistoryEntry> {
    const snapshot = await this.collection(userId).doc(historyId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "History entry was not found.", "history_not_found");
    }

    return mapHistoryDocument(snapshot.id, snapshot.data() as HistoryDocument);
  }

  async updateWatchedAt(userId: string, historyId: string, input: UpdateHistoryInput): Promise<HistoryEntry> {
    const ref = this.collection(userId).doc(historyId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "History entry was not found.", "history_not_found");
    }

    const watchedAt = parseHistoryWatchedAt(input.watchedAt);
    await ref.set(
      {
        watchedAt: Timestamp.fromDate(watchedAt),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    const updated = await ref.get();
    const mapped = mapHistoryDocument(updated.id, updated.data() as HistoryDocument);
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    return mapped;
  }

  async delete(userId: string, historyId: string): Promise<HistoryEntry> {
    const entry = await this.get(userId, historyId);
    await this.collection(userId).doc(historyId).delete();
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    return entry;
  }

  async recordMovie(userId: string, input: MovieHistoryInput): Promise<void> {
    const ref = this.collection(userId).doc(historyIdForMovie(input.tmdbId));
    const existing = await ref.get();
    const isRewatch = existing.exists;

    await ref.set(
      {
        tmdbId: input.tmdbId,
        mediaType: "movie",
        title: input.title,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: isRewatch
          ? (existing.get("watchedAt") ?? FieldValue.serverTimestamp())
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        rewatchCount: isRewatch ? FieldValue.increment(1) : 0,
        genreNames: input.genreNames ?? existing.get("genreNames") ?? [],
        runtimeMinutes: input.runtimeMinutes ?? existing.get("runtimeMinutes") ?? null,
      },
      {merge: true},
    );
    await derivedCacheService.invalidateUserLibraryCaches(userId);
  }

  async removeMovie(userId: string, tmdbId: number): Promise<void> {
    await this.collection(userId).doc(historyIdForMovie(tmdbId)).delete();
    await derivedCacheService.invalidateUserLibraryCaches(userId);
  }

  async recordEpisode(userId: string, input: EpisodeHistoryInput): Promise<void> {
    const ref = this.collection(userId).doc(`tv_${input.tmdbId}_${input.episodeKey}`);
    const existing = await ref.get();
    const isRewatch = existing.exists;

    await ref.set(
      {
        tmdbId: input.tmdbId,
        mediaType: "tv",
        title: input.title,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeTitle: input.episodeTitle,
        watchedAt: isRewatch
          ? (existing.get("watchedAt") ?? FieldValue.serverTimestamp())
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        rewatchCount: isRewatch ? FieldValue.increment(1) : 0,
        genreNames: input.genreNames ?? existing.get("genreNames") ?? [],
        runtimeMinutes: input.runtimeMinutes ?? existing.get("runtimeMinutes") ?? null,
      },
      {merge: true},
    );
    await derivedCacheService.invalidateUserLibraryCaches(userId);
  }

  async removeEpisode(userId: string, tmdbId: number, episodeKey: string): Promise<void> {
    await this.collection(userId).doc(`tv_${tmdbId}_${episodeKey}`).delete();
    await derivedCacheService.invalidateUserLibraryCaches(userId);
  }
}

export const historyService = new HistoryService();
