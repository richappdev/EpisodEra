import {HistoryEntry} from "../models/history";
import {ChallengeDefinition, ChallengeId, ChallengeProgress} from "../models/social";

export const challengeDefinitions: ChallengeDefinition[] = [
  {
    id: "crime-marathon",
    title: "Crime Marathon",
    description: "Watch 25 crime episodes.",
    target: 25,
    unit: "episodes",
  },
  {
    id: "franchise-finisher",
    title: "Franchise Finisher",
    description: "Complete one curated franchise.",
    target: 1,
    unit: "franchises",
  },
  {
    id: "rewatch-club",
    title: "Rewatch Club",
    description: "Log 3 rewatches.",
    target: 3,
    unit: "rewatches",
  },
  {
    id: "quick-hit-weekend",
    title: "Quick-Hit Weekend",
    description: "Watch 10 titles under 45 minutes.",
    target: 10,
    unit: "titles",
  },
];

const percent = (current: number, target: number) =>
  target <= 0 ? 0 : Number((Math.min(current / target, 1) * 100).toFixed(2));

export const genreOverlapScore = (left: string[], right: string[]) => {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  if (leftSet.size === 0 && rightSet.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const genre of leftSet) {
    if (rightSet.has(genre)) {
      shared += 1;
    }
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return Number(((shared / union) * 100).toFixed(2));
};

export const topGenreNames = (history: HistoryEntry[], limit = 5): string[] => {
  const counts = new Map<string, number>();
  for (const entry of history) {
    for (const genre of entry.genreNames ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name]) => name);
};

export const shouldHideSpoiler = (input: {
  hideSpoilersUntilWatched: boolean;
  mediaType: "movie" | "tv";
  tmdbId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  viewerHistory: HistoryEntry[];
}) => {
  if (!input.hideSpoilersUntilWatched) {
    return false;
  }

  if (input.mediaType === "movie") {
    return !input.viewerHistory.some(
      (entry) => entry.mediaType === "movie" && entry.tmdbId === input.tmdbId,
    );
  }

  if (input.seasonNumber == null || input.episodeNumber == null) {
    return false;
  }

  return !input.viewerHistory.some(
    (entry) =>
      entry.mediaType === "tv" &&
      entry.tmdbId === input.tmdbId &&
      entry.seasonNumber === input.seasonNumber &&
      entry.episodeNumber === input.episodeNumber,
  );
};

export const evaluateChallenges = (input: {
  history: HistoryEntry[];
  completedFranchises: number;
  friendHistory?: HistoryEntry[];
  friendCompletedFranchises?: number;
}): ChallengeProgress[] => {
  const metrics = (history: HistoryEntry[], completedFranchises: number): Record<ChallengeId, number> => ({
    "crime-marathon": history.filter(
      (entry) =>
        entry.mediaType === "tv" &&
        (entry.genreNames ?? []).some((genre) => genre.toLowerCase() === "crime"),
    ).length,
    "franchise-finisher": completedFranchises,
    "rewatch-club": history.reduce((total, entry) => total + Math.max(0, entry.rewatchCount ?? 0), 0),
    "quick-hit-weekend": new Set(
      history
        .filter((entry) => entry.runtimeMinutes != null && entry.runtimeMinutes <= 45)
        .map((entry) => `${entry.mediaType}:${entry.tmdbId}`),
    ).size,
  });

  const yours = metrics(input.history, input.completedFranchises);
  const theirs =
    input.friendHistory && input.friendCompletedFranchises != null
      ? metrics(input.friendHistory, input.friendCompletedFranchises)
      : null;

  return challengeDefinitions.map((challenge) => {
    const current = yours[challenge.id];
    const friendCurrent = theirs ? theirs[challenge.id] : undefined;
    return {
      ...challenge,
      current,
      progressPercent: percent(current, challenge.target),
      completed: current >= challenge.target,
      friendCurrent,
      friendProgressPercent:
        friendCurrent == null ? undefined : percent(friendCurrent, challenge.target),
    };
  });
};

export const generateFriendCode = (userId: string) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[hash % alphabet.length];
    hash = Math.floor(hash / alphabet.length) || userId.charCodeAt(index % userId.length);
  }
  return code;
};
