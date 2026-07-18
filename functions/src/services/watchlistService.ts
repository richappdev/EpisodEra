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
import {ShowProgressSummary} from "../models/progress";
import {historyService} from "./historyService";
import {mergeWatchlistStatus} from "./importLogic";
import {
  promotedTvWatchlistStatus,
  suggestedWatchlistStatusForProgress,
} from "./progressLogic";
import {tmdbService} from "./tmdbService";
import {
  itemNeedsImageBackfill,
  mapInChunks,
  mergeWatchlistImages,
  normalizeImageUrl,
  preferImageUrl,
} from "./watchlistPosterLogic";

const POSTER_BACKFILL_CONCURRENCY = 5;

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
  poster: normalizeImageUrl(data.poster),
  backdrop: normalizeImageUrl(data.backdrop),
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
    poster: normalizeImageUrl(optionalString(body.poster, "poster")),
    backdrop: normalizeImageUrl(optionalString(body.backdrop, "backdrop")),
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

  /**
   * Fill missing poster/backdrop URLs from TMDb and persist them.
   * Does not bump updatedAt so list order stays stable.
   */
  async backfillMissingImages(userId: string, items: WatchlistItem[]): Promise<WatchlistItem[]> {
    const missing = items.filter(itemNeedsImageBackfill);
    if (missing.length === 0) {
      return items;
    }

    const updates = await mapInChunks(missing, POSTER_BACKFILL_CONCURRENCY, async (item) => {
      try {
        const detail =
          item.mediaType === "movie" ?
            await tmdbService.movieDetail(item.tmdbId) :
            await tmdbService.tvDetail(item.tmdbId);
        const merged = mergeWatchlistImages(item, detail.images);
        if (merged.poster === item.poster && merged.backdrop === item.backdrop) {
          return item;
        }

        await this.collection(userId).doc(item.itemId).update({
          poster: merged.poster,
          backdrop: merged.backdrop,
        });

        return {...item, poster: merged.poster, backdrop: merged.backdrop};
      } catch {
        return item;
      }
    });

    const byId = new Map(updates.map((item) => [item.itemId, item]));
    return items.map((item) => byId.get(item.itemId) ?? item);
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
          poster: normalizeImageUrl(input.poster),
          backdrop: normalizeImageUrl(input.backdrop),
          status: input.status ?? defaultStatusFor(input.mediaType),
          addedAt: existing.exists ? existing.get("addedAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    return this.get(userId, itemId);
  }

  /** Import merge: never downgrade status; keep existing titles when present. */
  async mergeImport(userId: string, input: AddWatchlistItemInput): Promise<WatchlistItem> {
    const itemId = itemIdFor(input.mediaType, input.tmdbId);
    const ref = this.collection(userId).doc(itemId);
    const incomingStatus = normalizeStatusForMediaType(
      input.mediaType,
      input.status ?? defaultStatusFor(input.mediaType),
    );

    if (!isValidStatusForMediaType(input.mediaType, incomingStatus)) {
      throw new HttpError(400, statusErrorForMediaType(input.mediaType), "invalid_status");
    }

    await getFirestore().runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      const existingData = existing.exists ? (existing.data() as WatchlistDocument) : null;
      const mergedStatus = mergeWatchlistStatus(
        input.mediaType,
        existingData ? normalizeStatusForMediaType(existingData.mediaType, existingData.status) : null,
        incomingStatus,
      );

      transaction.set(
        ref,
        {
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          title: existingData?.title?.trim() ? existingData.title : input.title,
          poster: preferImageUrl(existingData?.poster, input.poster),
          backdrop: preferImageUrl(existingData?.backdrop, input.backdrop),
          status: mergedStatus,
          addedAt: existing.exists ? existing.get("addedAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    const item = await this.get(userId, itemId);
    if (item.mediaType === "movie" && item.status === "watched") {
      await historyService.recordMovie(userId, {
        tmdbId: item.tmdbId,
        title: item.title,
      });
    }

    return item;
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

  /**
   * Promote TV watchlist status from progress (planned → watching, planned|watching → completed).
   * No-ops when the show is not on the watchlist or promotion rules do not apply.
   */
  async syncTvStatusFromProgress(
    userId: string,
    tmdbId: number,
    progress: Pick<ShowProgressSummary, "watchedEpisodeCount" | "totalEpisodes" | "nextEpisode">,
  ): Promise<WatchlistItem | null> {
    const itemId = itemIdFor("tv", tmdbId);
    const snapshot = await this.collection(userId).doc(itemId).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as WatchlistDocument;
    const nextStatus = promotedTvWatchlistStatus(
      normalizeStatusForMediaType(data.mediaType, data.status),
      suggestedWatchlistStatusForProgress(progress),
    );
    if (!nextStatus) {
      return null;
    }

    return this.updateStatus(userId, itemId, nextStatus);
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
