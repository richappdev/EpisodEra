export type AchievementId =
  | "detective"
  | "anime-explorer"
  | "loyal-fan"
  | "completionist"
  | "rewatcher";

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  category: "viewing" | "franchise" | "social";
}

export interface AchievementProgress {
  id: AchievementId;
  title: string;
  description: string;
  category: "viewing" | "franchise" | "social";
  unlocked: boolean;
  unlockedAt: string | null;
  current: number;
  target: number;
  progressPercent: number;
}

export interface AchievementsResponse {
  enabled: boolean;
  showOnProfile: boolean;
  items: AchievementProgress[];
  unlockedCount: number;
}
