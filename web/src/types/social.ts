export type FriendStatus = "pending_outgoing" | "pending_incoming" | "accepted";

export interface FriendSummary {
  userId: string;
  friendCode: string | null;
  displayName: string;
  status: FriendStatus;
  updatedAt: string | null;
}

export interface FriendsResponse {
  friendCode: string;
  allowFriendRequests: boolean;
  shareActivityWithFriends: boolean;
  items: FriendSummary[];
}

export interface ActivityFeedItem {
  feedId: string;
  friendUserId: string;
  friendDisplayName: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  watchedAt: string | null;
  spoilerHidden: boolean;
}

export interface CompatibilityResult {
  friendUserId: string;
  friendDisplayName: string;
  score: number;
  sharedGenres: string[];
  yourTopGenres: string[];
  theirTopGenres: string[];
}

export interface ChallengeProgress {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  current: number;
  progressPercent: number;
  completed: boolean;
  friendCurrent?: number;
  friendProgressPercent?: number;
}

export interface DiscussionComment {
  commentId: string;
  userId: string;
  displayName: string;
  body: string | null;
  mediaType: "movie" | "tv";
  tmdbId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  createdAt: string | null;
  spoilerHidden: boolean;
}
