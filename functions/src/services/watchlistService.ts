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
import {derivedCacheService} from "./derivedCacheService";
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

  private mapSupabaseRow(row: Record<string, unknown>): WatchlistItem {
    const mediaType = row.media_type === "movie" || row.media_type === "tv" ? row.media_type : "tv";
    const tmdbId = Number(row.tmdb_id);
    const status = normalizeStatusForMediaType(
      mediaType,
      isWatchlistStatus(row.status) ? row.status : defaultStatusFor(mediaType),
    );
    return {
      itemId: itemIdFor(mediaType, tmdbId),
      tmdbId,
      mediaType,
      title: String(row.title ?? ""),
      poster: normalizeImageUrl((row.poster_path as string | null) ?? null),
      backdrop: normalizeImageUrl((row.backdrop_path as string | null) ?? null),
      status,
      addedAt: typeof row.added_at === "string" ? row.added_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    };
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<WatchlistItem>> {
    const {isSupabaseReadWatchlist} = await import("../config/env");
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");
    if (isSupabaseReadWatchlist()) {
      const env = getSupabaseEnvOrNull();
      if (env) {
        const {decodeSupabaseOffsetToken, paginateRows} = await import("../lib/supabasePagination");
        const offset = decodeSupabaseOffsetToken(pagination.pageToken);
        const limit = pagination.pageSize + 1;
        const rows = (await supabaseRest(
          env,
          `watchlist_items?firebase_uid=eq.${encodeURIComponent(userId)}` +
            `&select=*&order=updated_at.desc,media_type.asc,tmdb_id.asc` +
            `&offset=${offset}&limit=${limit}`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const list = Array.isArray(rows) ? rows : [];
        if (offset > 0 || list.length > 0) {
          return paginateRows(list.map((row) => this.mapSupabaseRow(row)), pagination, offset);
        }
      }
    }

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

        const {shouldPersistFirestore} = await import("../config/env");
        if (shouldPersistFirestore()) {
          await this.collection(userId).doc(item.itemId).update({
            poster: merged.poster,
            backdrop: merged.backdrop,
          });
        }

        const next = {...item, poster: merged.poster, backdrop: merged.backdrop};
        const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
        const {upsertWatchlistShadow} = await import("../migration/supabaseWriters");
        await writeSupabasePrimaryOrShadow({
          domain: "watchlist",
          operation: "backfillImages",
          firebaseUid: userId,
          operationId: `watchlist:images:${userId}:${item.itemId}:${Date.now()}`,
          payload: next,
          write: () => upsertWatchlistShadow(userId, next),
        });

        return next;
      } catch {
        return item;
      }
    });

    const byId = new Map(updates.map((item) => [item.itemId, item]));
    return items.map((item) => byId.get(item.itemId) ?? item);
  }

  async add(userId: string, input: AddWatchlistItemInput): Promise<WatchlistItem> {
    const {shouldPersistFirestore} = await import("../config/env");
    const itemId = itemIdFor(input.mediaType, input.tmdbId);
    const ref = this.collection(userId).doc(itemId);
    const nowIso = new Date().toISOString();
    const status = input.status ?? defaultStatusFor(input.mediaType);

    if (shouldPersistFirestore()) {
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
            status,
            addedAt: existing.exists ? existing.get("addedAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
        );
      });
    }

    const item = shouldPersistFirestore()
      ? await this.get(userId, itemId)
      : {
        itemId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.title,
        poster: normalizeImageUrl(input.poster),
        backdrop: normalizeImageUrl(input.backdrop),
        status,
        addedAt: nowIso,
        updatedAt: nowIso,
      };
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertWatchlistShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "watchlist",
      operation: "upsert",
      firebaseUid: userId,
      operationId: `watchlist:upsert:${userId}:${itemId}:${Date.now()}`,
      payload: item,
      write: () => upsertWatchlistShadow(userId, item),
    });
    return item;
  }
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

    const {shouldPersistFirestore} = await import("../config/env");
    const nowIso = new Date().toISOString();
    let mergedStatus = incomingStatus;
    let existingData: WatchlistDocument | null = null;

    if (shouldPersistFirestore()) {
      await getFirestore().runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        existingData = existing.exists ? (existing.data() as WatchlistDocument) : null;
        mergedStatus = mergeWatchlistStatus(
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
    } else {
      mergedStatus = mergeWatchlistStatus(input.mediaType, null, incomingStatus);
    }

    const item = shouldPersistFirestore()
      ? await this.get(userId, itemId)
      : {
        itemId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.title,
        poster: preferImageUrl(null, input.poster),
        backdrop: preferImageUrl(null, input.backdrop),
        status: mergedStatus,
        addedAt: nowIso,
        updatedAt: nowIso,
      };
    if (item.mediaType === "movie" && item.status === "watched") {
      await historyService.recordMovie(userId, {
        tmdbId: item.tmdbId,
        title: item.title,
      });
    } else {
      await derivedCacheService.invalidateUserLibraryCaches(userId);
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertWatchlistShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "watchlist",
      operation: "mergeImport",
      firebaseUid: userId,
      operationId: `watchlist:merge:${userId}:${itemId}:${Date.now()}`,
      payload: item,
      write: () => upsertWatchlistShadow(userId, item),
    });

    return item;
  }

  async updateStatus(userId: string, itemId: string, status: WatchlistStatus): Promise<WatchlistItem> {
    const {shouldPersistFirestore} = await import("../config/env");
    const parsed = parseItemId(itemId);
    if (!isValidStatusForMediaType(parsed.mediaType, status)) {
      throw new HttpError(400, statusErrorForMediaType(parsed.mediaType), "invalid_status");
    }

    const existing = await this.getOrNull(userId, itemId);
    if (!existing) {
      throw new HttpError(404, "Watchlist item was not found.", "watchlist_item_not_found");
    }

    if (shouldPersistFirestore()) {
      await this.collection(userId).doc(itemId).update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (existing.mediaType === "movie") {
      const previousStatus = normalizeStatusForMediaType(existing.mediaType, existing.status);
      if (status === "watched") {
        await historyService.recordMovie(userId, {
          tmdbId: existing.tmdbId,
          title: existing.title,
        });
      } else if (previousStatus === "watched") {
        await historyService.removeMovie(userId, existing.tmdbId);
      } else {
        await derivedCacheService.invalidateUserLibraryCaches(userId);
      }
    } else {
      await derivedCacheService.invalidateUserLibraryCaches(userId);
    }

    const item: WatchlistItem = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    if (shouldPersistFirestore()) {
      Object.assign(item, await this.get(userId, itemId));
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertWatchlistShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "watchlist",
      operation: "updateStatus",
      firebaseUid: userId,
      operationId: `watchlist:status:${userId}:${itemId}:${Date.now()}`,
      payload: item,
      write: () => upsertWatchlistShadow(userId, item),
    });
    return item;
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
    const {shouldPersistFirestore} = await import("../config/env");
    const parsed = parseItemId(itemId);
    const existing = await this.getOrNull(userId, itemId);

    if (shouldPersistFirestore()) {
      await this.collection(userId).doc(itemId).delete();
    }

    if (parsed.mediaType === "movie" && existing) {
      await historyService.removeMovie(userId, parsed.tmdbId);
    } else {
      await derivedCacheService.invalidateUserLibraryCaches(userId);
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {removeWatchlistShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "watchlist",
      operation: "remove",
      firebaseUid: userId,
      operationId: `watchlist:remove:${userId}:${itemId}:${Date.now()}`,
      payload: {itemId, mediaType: parsed.mediaType, tmdbId: parsed.tmdbId},
      write: () => removeWatchlistShadow(userId, parsed.mediaType, parsed.tmdbId),
    });
  }

  private async getOrNull(userId: string, itemId: string): Promise<WatchlistItem | null> {
    const {isSupabaseReadWatchlist, shouldPersistFirestore} = await import("../config/env");
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");
    if (!shouldPersistFirestore() || isSupabaseReadWatchlist()) {
      const env = getSupabaseEnvOrNull();
      if (env) {
        const parsed = parseItemId(itemId);
        const rows = (await supabaseRest(
          env,
          `watchlist_items?firebase_uid=eq.${encodeURIComponent(userId)}` +
            `&media_type=eq.${parsed.mediaType}&tmdb_id=eq.${parsed.tmdbId}&select=*&limit=1`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (row) {
          return this.mapSupabaseRow(row);
        }
      }
    }

    if (!shouldPersistFirestore()) {
      return null;
    }

    const snapshot = await this.collection(userId).doc(itemId).get();
    if (!snapshot.exists) {
      return null;
    }
    return mapDocument(snapshot.id, snapshot.data() as WatchlistDocument);
  }

  private async get(userId: string, itemId: string): Promise<WatchlistItem> {
    const item = await this.getOrNull(userId, itemId);
    if (!item) {
      throw new HttpError(404, "Watchlist item was not found.", "watchlist_item_not_found");
    }
    return item;
  }
}

export const watchlistService = new WatchlistService();
