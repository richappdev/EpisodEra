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

class DiscussionService {
  private collection(mediaType: "movie" | "tv", tmdbId: number) {
    return getFirestore().collection("public").doc("discussions").collection(discussionKey(mediaType, tmdbId));
  }

  async list(
    userId: string | null,
    mediaType: "movie" | "tv",
    tmdbId: number,
  ): Promise<{items: DiscussionComment[]}> {
    const snapshot = await this.collection(mediaType, tmdbId).orderBy("createdAt", "desc").limit(50).get();
    const hideSpoilers = userId
      ? (await settingsService.get(userId)).hideSpoilersUntilWatched
      : true;

    const historyIds = snapshot.docs
      .map((doc) => {
        const data = doc.data() as DiscussionDocument;
        return historyIdForCoords({
          mediaType: data.mediaType,
          tmdbId: data.tmdbId,
          seasonNumber: data.seasonNumber,
          episodeNumber: data.episodeNumber,
        });
      })
      .filter((value): value is string => Boolean(value));

    const watchedHistoryIds = userId && hideSpoilers
      ? await historyService.existsMany(userId, historyIds)
      : new Set<string>();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as DiscussionDocument;
      const historyId = historyIdForCoords({
        mediaType: data.mediaType,
        tmdbId: data.tmdbId,
        seasonNumber: data.seasonNumber,
        episodeNumber: data.episodeNumber,
      });
      const spoilerHidden = shouldHideSpoilerByHistoryId({
        hideSpoilersUntilWatched: hideSpoilers,
        historyId,
        watchedHistoryIds,
      });
      return {
        commentId: doc.id,
        userId: data.userId,
        displayName: data.displayName,
        body: spoilerHidden ? null : data.body,
        mediaType: data.mediaType,
        tmdbId: data.tmdbId,
        seasonNumber: data.seasonNumber,
        episodeNumber: data.episodeNumber,
        createdAt: timestampToJson(data.createdAt),
        spoilerHidden,
      };
    });

    return {items};
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
    await ref.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      commentId: ref.id,
      ...payload,
      createdAt: new Date().toISOString(),
      spoilerHidden: false,
    };
  }
}

export const discussionService = new DiscussionService();
