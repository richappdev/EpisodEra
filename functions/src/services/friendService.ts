import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {fetchAllPages} from "../lib/pagination";
import {UserProfile} from "../models/profile";
import {
  ActivityFeedItem,
  CompatibilityResult,
  FriendStatus,
  FriendSummary,
  FriendsResponse,
} from "../models/social";
import {generateFriendCode, genreOverlapScore, shouldHideSpoiler, topGenreNames} from "./socialLogic";
import {historyService} from "./historyService";
import {profileService} from "./profileService";
import {settingsService} from "./settingsService";

interface FriendDocument {
  status: FriendStatus;
  displayName?: string;
  friendCode?: string | null;
  updatedAt?: Timestamp;
}

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

class FriendService {
  private friends(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("friends");
  }

  private users() {
    return getFirestore().collection("users");
  }

  async ensureFriendCode(userId: string): Promise<string> {
    const ref = this.users().doc(userId);
    const snapshot = await ref.get();
    const existing = snapshot.exists ? snapshot.data()?.friendCode : null;
    if (typeof existing === "string" && existing.length >= 6) {
      return existing;
    }

    const friendCode = generateFriendCode(userId);
    await ref.set({friendCode, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    return friendCode;
  }

  async findUserIdByFriendCode(friendCode: string): Promise<string | null> {
    const snapshot = await this.users().where("friendCode", "==", friendCode.toUpperCase()).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return snapshot.docs[0].id;
  }

  private displayNameFor(profile: UserProfile | null, fallback: string) {
    if (!profile) {
      return fallback;
    }
    return (
      profile.displayName ||
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
      profile.email ||
      fallback
    );
  }

  async list(userId: string): Promise<FriendsResponse> {
    const [settings, friendCode, snapshot] = await Promise.all([
      settingsService.get(userId),
      this.ensureFriendCode(userId),
      this.friends(userId).orderBy("updatedAt", "desc").get(),
    ]);

    const items: FriendSummary[] = snapshot.docs.map((doc) => {
      const data = doc.data() as FriendDocument;
      return {
        userId: doc.id,
        friendCode: data.friendCode ?? null,
        displayName: data.displayName ?? "Friend",
        status: data.status,
        updatedAt: timestampToJson(data.updatedAt),
      };
    });

    return {
      friendCode,
      allowFriendRequests: settings.allowFriendRequests,
      shareActivityWithFriends: settings.shareActivityWithFriends,
      items,
    };
  }

  async requestByCode(userId: string, friendCodeRaw: string): Promise<FriendsResponse> {
    const friendCode = friendCodeRaw.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(friendCode)) {
      throw new HttpError(400, "Friend code must be 6 characters.", "invalid_friend_code");
    }

    const settings = await settingsService.get(userId);
    if (!settings.allowFriendRequests) {
      throw new HttpError(403, "Friend requests are disabled in your settings.", "friend_requests_disabled");
    }

    await this.ensureFriendCode(userId);
    const targetUserId = await this.findUserIdByFriendCode(friendCode);
    if (!targetUserId) {
      throw new HttpError(404, "No user found for that friend code.", "friend_not_found");
    }
    if (targetUserId === userId) {
      throw new HttpError(400, "You cannot add yourself.", "invalid_friend_target");
    }

    const targetSettings = await settingsService.get(targetUserId);
    if (!targetSettings.allowFriendRequests) {
      throw new HttpError(403, "That user is not accepting friend requests.", "friend_requests_disabled");
    }

    const [selfProfile, targetProfile] = await Promise.all([
      profileService.get(userId),
      profileService.get(targetUserId),
    ]);

    const batch = getFirestore().batch();
    batch.set(
      this.friends(userId).doc(targetUserId),
      {
        status: "pending_outgoing",
        displayName: this.displayNameFor(targetProfile, "Friend"),
        friendCode,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    batch.set(
      this.friends(targetUserId).doc(userId),
      {
        status: "pending_incoming",
        displayName: this.displayNameFor(selfProfile, "Friend"),
        friendCode: await this.ensureFriendCode(userId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    await batch.commit();
    return this.list(userId);
  }

  async updateStatus(userId: string, friendUserId: string, status: "accepted" | "declined" | "removed") {
    const friendRef = this.friends(userId).doc(friendUserId);
    const mirrorRef = this.friends(friendUserId).doc(userId);
    const [friendSnap, mirrorSnap] = await Promise.all([friendRef.get(), mirrorRef.get()]);

    if (!friendSnap.exists) {
      throw new HttpError(404, "Friend relationship not found.", "friend_not_found");
    }

    if (status === "removed" || status === "declined") {
      const batch = getFirestore().batch();
      batch.delete(friendRef);
      if (mirrorSnap.exists) {
        batch.delete(mirrorRef);
      }
      await batch.commit();
      return this.list(userId);
    }

    const batch = getFirestore().batch();
    batch.set(friendRef, {status: "accepted", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    batch.set(mirrorRef, {status: "accepted", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    await batch.commit();
    return this.list(userId);
  }

  async acceptedFriendIds(userId: string): Promise<string[]> {
    const snapshot = await this.friends(userId).where("status", "==", "accepted").get();
    return snapshot.docs.map((doc) => doc.id);
  }

  async feed(userId: string): Promise<{items: ActivityFeedItem[]}> {
    const [settings, friendIds, viewerHistory] = await Promise.all([
      settingsService.get(userId),
      this.acceptedFriendIds(userId),
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
    ]);

    const items: ActivityFeedItem[] = [];
    for (const friendUserId of friendIds.slice(0, 20)) {
      const friendSettings = await settingsService.get(friendUserId);
      if (!friendSettings.shareActivityWithFriends) {
        continue;
      }
      const [friendProfile, friendHistory] = await Promise.all([
        profileService.get(friendUserId),
        historyService.list(friendUserId, {page: 1, pageSize: 10}),
      ]);
      const displayName = this.displayNameFor(friendProfile, "Friend");
      for (const entry of friendHistory.items) {
        const spoilerHidden = shouldHideSpoiler({
          hideSpoilersUntilWatched: settings.hideSpoilersUntilWatched,
          mediaType: entry.mediaType,
          tmdbId: entry.tmdbId,
          seasonNumber: entry.seasonNumber,
          episodeNumber: entry.episodeNumber,
          viewerHistory,
        });
        items.push({
          feedId: `${friendUserId}_${entry.historyId}`,
          friendUserId,
          friendDisplayName: displayName,
          tmdbId: entry.tmdbId,
          mediaType: entry.mediaType,
          title: entry.title,
          seasonNumber: entry.seasonNumber,
          episodeNumber: entry.episodeNumber,
          episodeTitle: spoilerHidden ? null : entry.episodeTitle,
          watchedAt: entry.watchedAt,
          spoilerHidden,
        });
      }
    }

    items.sort((left, right) => Date.parse(right.watchedAt ?? "") - Date.parse(left.watchedAt ?? ""));
    return {items: items.slice(0, 40)};
  }

  async compatibility(userId: string, friendUserId: string): Promise<CompatibilityResult> {
    const friendSnap = await this.friends(userId).doc(friendUserId).get();
    if (!friendSnap.exists || (friendSnap.data() as FriendDocument).status !== "accepted") {
      throw new HttpError(404, "Accepted friend not found.", "friend_not_found");
    }

    const [yourHistory, theirHistory, friendProfile] = await Promise.all([
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
      fetchAllPages((pagination) => historyService.list(friendUserId, pagination)),
      profileService.get(friendUserId),
    ]);

    const yourTopGenres = topGenreNames(yourHistory);
    const theirTopGenres = topGenreNames(theirHistory);
    const sharedGenres = yourTopGenres.filter((genre) =>
      theirTopGenres.some((candidate) => candidate.toLowerCase() === genre.toLowerCase()),
    );

    return {
      friendUserId,
      friendDisplayName: this.displayNameFor(friendProfile, "Friend"),
      score: genreOverlapScore(yourTopGenres, theirTopGenres),
      sharedGenres,
      yourTopGenres,
      theirTopGenres,
    };
  }
}

export const friendService = new FriendService();
