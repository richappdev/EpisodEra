import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {DiscussionComment} from "../models/social";
import {historyIdForCoords, historyService} from "./historyService";
import {profileService} from "./profileService";
import {settingsService} from "./settingsService";
import {shouldHideSpoilerByHistoryId} from "./socialLogic";

interface DiscussionDocument {
  userId: string;
  displayName: string;
  body: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  createdAt?: Timestamp;
}

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const discussionKey = (mediaType: "movie" | "tv", tmdbId: number) => `${mediaType}_${tmdbId}`;

const mapSupabaseRow = (row: Record<string, unknown>): Omit<DiscussionComment, "spoilerHidden" | "body"> & {body: string} => ({
  commentId: String(row.firestore_id ?? row.id ?? ""),
  userId: String(row.author_firebase_uid ?? ""),
  displayName: String(row.display_name ?? "Viewer"),
  body: String(row.body ?? ""),
  mediaType: row.media_type === "movie" ? "movie" : "tv",
  tmdbId: Number(row.tmdb_id),
  seasonNumber: row.season_number == null ? null : Number(row.season_number),
  episodeNumber: row.episode_number == null ? null : Number(row.episode_number),
  createdAt: typeof row.created_at === "string" ? row.created_at : null,
});

class DiscussionService {
  private collection(mediaType: "movie" | "tv", tmdbId: number) {
    return getFirestore().collection("public").doc("discussions").collection(discussionKey(mediaType, tmdbId));
  }

  private async applySpoilerFilter(
    userId: string | null,
    rawItems: Array<Omit<DiscussionComment, "spoilerHidden" | "body"> & {body: string}>,
  ): Promise<{items: DiscussionComment[]}> {
    const hideSpoilers = userId
      ? (await settingsService.get(userId)).hideSpoilersUntilWatched
      : true;

    const historyIds = rawItems
      .map((item) =>
        historyIdForCoords({
          mediaType: item.mediaType,
          tmdbId: item.tmdbId,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
        }),
      )
      .filter((value): value is string => Boolean(value));

    const watchedHistoryIds = userId && hideSpoilers
      ? await historyService.existsMany(userId, historyIds)
      : new Set<string>();

    const items = rawItems.map((item) => {
      const historyId = historyIdForCoords({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
      });
      const spoilerHidden = shouldHideSpoilerByHistoryId({
        hideSpoilersUntilWatched: hideSpoilers,
        historyId,
        watchedHistoryIds,
      });
      return {
        ...item,
        body: spoilerHidden ? null : item.body,
        spoilerHidden,
      };
    });

    return {items};
  }

  async list(
    userId: string | null,
    mediaType: "movie" | "tv",
    tmdbId: number,
  ): Promise<{items: DiscussionComment[]}> {
    const {isSupabaseReadDiscussions} = await import("../config/env");
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");

    if (isSupabaseReadDiscussions()) {
      const env = getSupabaseEnvOrNull();
      if (env) {
        const rows = (await supabaseRest(
          env,
          `discussion_comments?media_type=eq.${mediaType}&tmdb_id=eq.${tmdbId}` +
            `&deleted_at=is.null&select=*&order=created_at.desc&limit=50`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        if (Array.isArray(rows) && rows.length > 0) {
          return this.applySpoilerFilter(userId, rows.map(mapSupabaseRow));
        }
      }
    }

    const snapshot = await this.collection(mediaType, tmdbId).orderBy("createdAt", "desc").limit(50).get();
    const rawItems = snapshot.docs.map((doc) => {
      const data = doc.data() as DiscussionDocument;
      return {
        commentId: doc.id,
        userId: data.userId,
        displayName: data.displayName,
        body: data.body,
        mediaType: data.mediaType,
        tmdbId: data.tmdbId,
        seasonNumber: data.seasonNumber,
        episodeNumber: data.episodeNumber,
        createdAt: timestampToJson(data.createdAt),
      };
    });
    return this.applySpoilerFilter(userId, rawItems);
  }

  async create(
    userId: string,
    input: {
      mediaType: "movie" | "tv";
      tmdbId: number;
      body: string;
      seasonNumber?: number | null;
      episodeNumber?: number | null;
    },
  ): Promise<DiscussionComment> {
    const {shouldPersistFirestore} = await import("../config/env");
    const body = input.body.trim();
    if (body.length < 2 || body.length > 500) {
      throw new HttpError(400, "Comment body must be 2-500 characters.", "invalid_discussion_body");
    }

    const historyId = historyIdForCoords({
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
      seasonNumber: input.seasonNumber ?? null,
      episodeNumber: input.episodeNumber ?? null,
    });
    const watchedHistoryIds = historyId
      ? await historyService.existsMany(userId, [historyId])
      : new Set<string>();
    const watched = !shouldHideSpoilerByHistoryId({
      hideSpoilersUntilWatched: true,
      historyId,
      watchedHistoryIds,
    });

    if (!watched) {
      throw new HttpError(
        403,
        "Watch this title before posting to keep discussions spoiler-safe.",
        "discussion_requires_watch",
      );
    }

    const profile = await profileService.get(userId);
    const displayName =
      profile?.displayName ||
      [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
      profile?.email ||
      "Viewer";

    const ref = this.collection(input.mediaType, input.tmdbId).doc();
    const payload: DiscussionDocument = {
      userId,
      displayName,
      body,
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
      seasonNumber: input.seasonNumber ?? null,
      episodeNumber: input.episodeNumber ?? null,
    };

    if (shouldPersistFirestore()) {
      await ref.set({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const comment: DiscussionComment = {
      commentId: ref.id,
      ...payload,
      createdAt: new Date().toISOString(),
      spoilerHidden: false,
    };

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertDiscussionCommentShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "discussions",
      operation: "create",
      firebaseUid: userId,
      operationId: `discussions:create:${userId}:${comment.commentId}`,
      payload: comment,
      write: () =>
        upsertDiscussionCommentShadow({
          commentId: comment.commentId,
          userId: comment.userId,
          displayName: comment.displayName,
          body: comment.body ?? body,
          mediaType: comment.mediaType,
          tmdbId: comment.tmdbId,
          seasonNumber: comment.seasonNumber,
          episodeNumber: comment.episodeNumber,
          createdAt: comment.createdAt,
        }),
    });

    return comment;
  }
}

export const discussionService = new DiscussionService();
