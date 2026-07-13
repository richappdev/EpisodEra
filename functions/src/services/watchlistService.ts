import {Timestamp, FieldValue, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {MediaType} from "../models/media";
import {
  AddWatchlistItemInput,
  WatchlistItem,
  WatchlistStatus,
  movieWatchlistStatuses,
  tvWatchlistStatuses,
  watchlistStatuses,
} from "../models/watchlist";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";

interface WatchlistDocument {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  backdrop: string | null;
  status: WatchlistStatus;
  addedAt?: Timestamp;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMediaType = (value: unknown): value is MediaType =>
  value === "movie" || value === "tv";

const isWatchlistStatus = (value: unknown): value is WatchlistStatus =>
  typeof value === "string" && watchlistStatuses.includes(value as WatchlistStatus);

const isValidStatusForMediaType = (mediaType: MediaType, status: WatchlistStatus) =>
  mediaType === "movie" ?
    movieWatchlistStatuses.includes(status as (typeof movieWatchlistStatuses)[number]) :
    tvWatchlistStatuses.includes(status as (typeof tvWatchlistStatuses)[number]);

const statusErrorForMediaType = (mediaType: MediaType) =>
  mediaType === "movie" ?
    "movie status must be unwatched or watched." :
    "tv status must be planned, watching, completed, or dropped.";

const defaultStatusFor = (mediaType: MediaType): WatchlistStatus =>
  mediaType === "movie" ? "unwatched" : "planned";

const normalizeStatusForMediaType = (mediaType: MediaType, status: WatchlistStatus): WatchlistStatus => {
  if (mediaType !== "movie") {
    return status;
  }

  return status === "watched" || status === "completed" ? "watched" : "unwatched";
};

const optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string or null.`, "invalid_watchlist_payload");
  }

  return value;
};

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const itemIdFor = (mediaType: MediaType, tmdbId: number) => `${mediaType}_${tmdbId}`;

const parseItemId = (itemId: string) => {
  const match = /^(movie|tv)_([1-9]\d*)$/.exec(itemId);
  if (!match) {
    throw new HttpError(400, "Watchlist item id must look like movie_550 or tv_95396.", "invalid_item_id");
  }

  return {
    mediaType: match[1] as MediaType,
    tmdbId: Number(match[2]),
  };
};

const mapDocument = (itemId: string, data: WatchlistDocument): WatchlistItem => ({
  itemId,
  tmdbId: data.tmdbId,
  mediaType: data.mediaType,
  title: data.title,
  poster: data.poster,
  backdrop: data.backdrop,
  status: normalizeStatusForMediaType(data.mediaType, data.status),
  addedAt: timestampToJson(data.addedAt),
  updatedAt: timestampToJson(data.updatedAt),
});

export const parseAddWatchlistItemInput = (body: unknown): AddWatchlistItemInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_watchlist_payload");
  }

  const tmdbId = Number(body.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new HttpError(400, "tmdbId must be a positive integer.", "invalid_watchlist_payload");
  }

  if (!isMediaType(body.mediaType)) {
    throw new HttpError(400, "mediaType must be movie or tv.", "invalid_watchlist_payload");
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new HttpError(400, "title is required.", "invalid_watchlist_payload");
  }

  if (body.status !== undefined && !isWatchlistStatus(body.status)) {
    throw new HttpError(400, "status is not supported.", "invalid_status");
  }

  const status = body.status ?? defaultStatusFor(body.mediaType);
  if (!isValidStatusForMediaType(body.mediaType, status)) {
    throw new HttpError(400, statusErrorForMediaType(body.mediaType), "invalid_status");
  }

  return {
    tmdbId,
    mediaType: body.mediaType,
    title: body.title.trim(),
    poster: optionalString(body.poster, "poster"),
    backdrop: optionalString(body.backdrop, "backdrop"),
    status,
  };
};

export const parseWatchlistStatusInput = (body: unknown): WatchlistStatus => {
  if (!isRecord(body) || !isWatchlistStatus(body.status)) {
    throw new HttpError(400, "status is not supported.", "invalid_status");
  }

  return body.status;
};

class WatchlistService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("watchlist");
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<WatchlistItem>> {
    const baseQuery = this.collection(userId).orderBy("updatedAt", "desc");

    return listPaginated(baseQuery, pagination, (doc) =>
      mapDocument(doc.id, doc.data() as WatchlistDocument),
    );
  }

  async add(userId: string, input: AddWatchlistItemInput): Promise<WatchlistItem> {
    const itemId = itemIdFor(input.mediaType, input.tmdbId);
    const ref = this.collection(userId).doc(itemId);

    await getFirestore().runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      transaction.set(
        ref,
        {
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          title: input.title,
          poster: input.poster ?? null,
          backdrop: input.backdrop ?? null,
          status: input.status ?? defaultStatusFor(input.mediaType),
          addedAt: existing.exists ? existing.get("addedAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    return this.get(userId, itemId);
  }

  async updateStatus(userId: string, itemId: string, status: WatchlistStatus): Promise<WatchlistItem> {
    const parsed = parseItemId(itemId);
    const ref = this.collection(userId).doc(itemId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new HttpError(404, "Watchlist item was not found.", "watchlist_item_not_found");
    }

    const data = snapshot.data() as WatchlistDocument;
    if (!isValidStatusForMediaType(parsed.mediaType, status)) {
      throw new HttpError(400, statusErrorForMediaType(parsed.mediaType), "invalid_status");
    }

    await ref.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (data.mediaType === "movie") {
      const previousStatus = normalizeStatusForMediaType(data.mediaType, data.status);
      if (status === "watched") {
        await historyService.recordMovie(userId, {
          tmdbId: data.tmdbId,
          title: data.title,
        });
      } else if (previousStatus === "watched") {
        await historyService.removeMovie(userId, data.tmdbId);
      }
    }

    return this.get(userId, itemId);
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const parsed = parseItemId(itemId);
    const ref = this.collection(userId).doc(itemId);
    const snapshot = await ref.get();

    await ref.delete();

    if (parsed.mediaType === "movie" && snapshot.exists) {
      await historyService.removeMovie(userId, parsed.tmdbId);
    }
  }

  private async get(userId: string, itemId: string): Promise<WatchlistItem> {
    const snapshot = await this.collection(userId).doc(itemId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Watchlist item was not found.", "watchlist_item_not_found");
    }

    return mapDocument(snapshot.id, snapshot.data() as WatchlistDocument);
  }
}

export const watchlistService = new WatchlistService();
