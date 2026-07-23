import {FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {MediaType} from "../models/media";
import {AddLikedItemInput, LikedItem} from "../models/likes";
import {derivedCacheService} from "./derivedCacheService";
import {tmdbService} from "./tmdbService";
import {
  itemNeedsImageBackfill,
  mapInChunks,
  mergeWatchlistImages,
  normalizeImageUrl,
} from "./watchlistPosterLogic";

const POSTER_BACKFILL_CONCURRENCY = 5;

interface LikedDocument {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  backdrop: string | null;
  likedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMediaType = (value: unknown): value is MediaType =>
  value === "movie" || value === "tv";

const optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string or null.`, "invalid_likes_payload");
  }

  return value;
};

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const itemIdFor = (mediaType: MediaType, tmdbId: number) => `${mediaType}_${tmdbId}`;

const parseItemId = (itemId: string) => {
  const match = /^(movie|tv)_([1-9]\d*)$/.exec(itemId);
  if (!match) {
    throw new HttpError(400, "Liked item id must look like movie_550 or tv_95396.", "invalid_item_id");
  }

  return {
    mediaType: match[1] as MediaType,
    tmdbId: Number(match[2]),
  };
};

const mapDocument = (itemId: string, data: LikedDocument): LikedItem => ({
  itemId,
  tmdbId: data.tmdbId,
  mediaType: data.mediaType,
  title: data.title,
  poster: normalizeImageUrl(data.poster),
  backdrop: normalizeImageUrl(data.backdrop),
  likedAt: timestampToJson(data.likedAt),
});

export const parseAddLikedItemInput = (body: unknown): AddLikedItemInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_likes_payload");
  }

  const tmdbId = Number(body.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new HttpError(400, "tmdbId must be a positive integer.", "invalid_likes_payload");
  }

  if (!isMediaType(body.mediaType)) {
    throw new HttpError(400, "mediaType must be movie or tv.", "invalid_likes_payload");
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new HttpError(400, "title is required.", "invalid_likes_payload");
  }

  return {
    tmdbId,
    mediaType: body.mediaType,
    title: body.title.trim(),
    poster: normalizeImageUrl(optionalString(body.poster, "poster")),
    backdrop: normalizeImageUrl(optionalString(body.backdrop, "backdrop")),
  };
};

class LikesService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("likes");
  }

  private mapSupabaseRow(row: Record<string, unknown>): LikedItem {
    const mediaType = row.media_type === "movie" || row.media_type === "tv" ? row.media_type : "tv";
    const tmdbId = Number(row.tmdb_id);
    return {
      itemId: itemIdFor(mediaType, tmdbId),
      tmdbId,
      mediaType,
      title: String(row.title ?? ""),
      poster: normalizeImageUrl((row.poster_path as string | null) ?? null),
      backdrop: null,
      likedAt: typeof row.liked_at === "string" ? row.liked_at : null,
    };
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<LikedItem>> {
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
          `likes?firebase_uid=eq.${encodeURIComponent(userId)}` +
            `&select=*&order=liked_at.desc,media_type.asc,tmdb_id.asc` +
            `&offset=${offset}&limit=${limit}`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const list = Array.isArray(rows) ? rows : [];
        if (offset > 0 || list.length > 0) {
          return paginateRows(list.map((row) => this.mapSupabaseRow(row)), pagination, offset);
        }
      }
    }

    const baseQuery = this.collection(userId).orderBy("likedAt", "desc");
    return listPaginated(baseQuery, pagination, (doc) =>
      mapDocument(doc.id, doc.data() as LikedDocument),
    );
  }

  /**
   * Fill missing poster/backdrop URLs from TMDb and persist them.
   * Does not bump likedAt so list order stays stable.
   */
  async backfillMissingImages(userId: string, items: LikedItem[]): Promise<LikedItem[]> {
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

        const next = {...item, poster: merged.poster, backdrop: merged.backdrop};
        const {shadowWrite} = await import("../migration/shadow");
        const {upsertLikeShadow} = await import("../migration/supabaseWriters");
        await shadowWrite({
          domain: "likes",
          operation: "backfillImages",
          firebaseUid: userId,
          operationId: `likes:images:${userId}:${item.itemId}:${Date.now()}`,
          payload: next,
          secondary: () => upsertLikeShadow(userId, next),
        });

        return next;
      } catch {
        return item;
      }
    });

    const byId = new Map(updates.map((item) => [item.itemId, item]));
    return items.map((item) => byId.get(item.itemId) ?? item);
  }

  async add(userId: string, input: AddLikedItemInput): Promise<LikedItem> {
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
          likedAt: existing.exists ?
            existing.get("likedAt") ?? FieldValue.serverTimestamp() :
            FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    const item = await this.get(userId, itemId);
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    const {shadowWrite} = await import("../migration/shadow");
    const {upsertLikeShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "likes",
      operation: "upsert",
      firebaseUid: userId,
      operationId: `likes:upsert:${userId}:${itemId}:${Date.now()}`,
      payload: item,
      secondary: () => upsertLikeShadow(userId, item),
    });
    return item;
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const parsed = parseItemId(itemId);
    await this.collection(userId).doc(itemId).delete();
    await derivedCacheService.invalidateUserLibraryCaches(userId);
    const {shadowWrite} = await import("../migration/shadow");
    const {removeLikeShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "likes",
      operation: "remove",
      firebaseUid: userId,
      operationId: `likes:remove:${userId}:${itemId}:${Date.now()}`,
      payload: {itemId, mediaType: parsed.mediaType, tmdbId: parsed.tmdbId},
      secondary: () => removeLikeShadow(userId, parsed.mediaType, parsed.tmdbId),
    });
  }

  private async get(userId: string, itemId: string): Promise<LikedItem> {
    const snapshot = await this.collection(userId).doc(itemId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Liked item was not found.", "liked_item_not_found");
    }

    return mapDocument(snapshot.id, snapshot.data() as LikedDocument);
  }
}

export const likesService = new LikesService();
