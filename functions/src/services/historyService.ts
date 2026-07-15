import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {MediaType} from "../models/media";
import {HistoryEntry, UpdateHistoryInput} from "../models/history";

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

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

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

    return listPaginated(baseQuery, pagination, (doc) =>
      mapHistoryDocument(doc.id, doc.data() as HistoryDocument),
    );
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
    return mapHistoryDocument(updated.id, updated.data() as HistoryDocument);
  }

  async delete(userId: string, historyId: string): Promise<HistoryEntry> {
    const entry = await this.get(userId, historyId);
    await this.collection(userId).doc(historyId).delete();
    return entry;
  }

  async recordMovie(userId: string, input: MovieHistoryInput): Promise<void> {
    const ref = this.collection(userId).doc(`movie_${input.tmdbId}`);
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
  }

  async removeMovie(userId: string, tmdbId: number): Promise<void> {
    await this.collection(userId).doc(`movie_${tmdbId}`).delete();
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
  }

  async removeEpisode(userId: string, tmdbId: number, episodeKey: string): Promise<void> {
    await this.collection(userId).doc(`tv_${tmdbId}_${episodeKey}`).delete();
  }
}

export const historyService = new HistoryService();
