import {AchievementDefinition, AchievementId, AchievementProgress} from "../models/achievement";
import {HistoryEntry} from "../models/history";
import {ShowProgressSummary} from "../models/progress";
import {WatchlistItem} from "../models/watchlist";
import {FranchiseProgress} from "../models/franchise";

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: "detective",
    title: "Detective",
    description: "Watch 500 crime episodes.",
    category: "viewing",
  },
  {
    id: "anime-explorer",
    title: "Anime Explorer",
    description: "Watch 20 animation titles.",
    category: "viewing",
  },
  {
    id: "loyal-fan",
    title: "Loyal Fan",
    description: "Follow one series across multiple calendar years.",
    category: "viewing",
  },
  {
    id: "completionist",
    title: "Completionist",
    description: "Complete an entire curated franchise.",
    category: "franchise",
  },
  {
    id: "rewatcher",
    title: "Rewatcher",
    description: "Rewatch a favorite title at least once.",
    category: "viewing",
  },
];

const progressPercent = (current: number, target: number) =>
  target <= 0 ? 0 : Number((Math.min(current / target, 1) * 100).toFixed(2));

const crimeEpisodeCount = (history: HistoryEntry[]) =>
  history.filter(
    (entry) =>
      entry.mediaType === "tv" &&
      (entry.genreNames ?? []).some((genre) => genre.toLowerCase() === "crime"),
  ).length;

const animationTitleCount = (history: HistoryEntry[]) => {
  const keys = new Set<string>();
  for (const entry of history) {
    if ((entry.genreNames ?? []).some((genre) => genre.toLowerCase() === "animation")) {
      keys.add(`${entry.mediaType}:${entry.tmdbId}`);
    }
  }
  return keys.size;
};

const loyalFanYears = (history: HistoryEntry[]) => {
  const yearsByShow = new Map<number, Set<number>>();
  for (const entry of history) {
    if (entry.mediaType !== "tv" || !entry.watchedAt) {
      continue;
    }
    const year = new Date(entry.watchedAt).getUTCFullYear();
    if (!Number.isFinite(year)) {
      continue;
    }
    const years = yearsByShow.get(entry.tmdbId) ?? new Set<number>();
    years.add(year);
    yearsByShow.set(entry.tmdbId, years);
  }
  let maxYears = 0;
  for (const years of yearsByShow.values()) {
    maxYears = Math.max(maxYears, years.size);
  }
  return maxYears;
};

const completedFranchiseCount = (franchiseProgress: FranchiseProgress[]) =>
  franchiseProgress.filter((item) => item.progressPercent >= 100).length;

const rewatchCount = (history: HistoryEntry[]) =>
  history.reduce((total, entry) => total + Math.max(0, entry.rewatchCount ?? 0), 0);

const metricFor = (
  id: AchievementId,
  history: HistoryEntry[],
  franchiseProgress: FranchiseProgress[],
): {current: number; target: number} => {
  switch (id) {
    case "detective":
      return {current: crimeEpisodeCount(history), target: 500};
    case "anime-explorer":
      return {current: animationTitleCount(history), target: 20};
    case "loyal-fan":
      return {current: loyalFanYears(history), target: 2};
    case "completionist":
      return {current: completedFranchiseCount(franchiseProgress), target: 1};
    case "rewatcher":
      return {current: rewatchCount(history), target: 1};
  }
};

export const evaluateAchievements = (input: {
  history: HistoryEntry[];
  watchlistItems: WatchlistItem[];
  progressItems: ShowProgressSummary[];
  franchiseProgress: FranchiseProgress[];
}): AchievementProgress[] =>
  achievementDefinitions.map((definition) => {
    const metric = metricFor(definition.id, input.history, input.franchiseProgress);
    const unlocked = metric.current >= metric.target;
    return {
      ...definition,
      unlocked,
      unlockedAt: null,
      current: metric.current,
      target: metric.target,
      progressPercent: progressPercent(metric.current, metric.target),
    };
  });
