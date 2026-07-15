import {MediaType} from "./media";

export type FranchiseOrder = "release" | "chronological";

export interface FranchisePhase {
  id: string;
  name: string;
}

export interface FranchiseTitle {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  phaseId: string;
  releaseOrder: number;
  chronologicalOrder: number;
  runtimeMinutes: number | null;
  /** TMDb watch-provider ids commonly associated with this title (optional hint for discovery). */
  providerIds?: number[];
}

export interface FranchiseSummary {
  slug: string;
  name: string;
  description: string;
  titleCount: number;
  phaseCount: number;
}

export interface FranchiseCatalog {
  slug: string;
  name: string;
  description: string;
  phases: FranchisePhase[];
  titles: FranchiseTitle[];
}

export type FranchiseTitleStatus = "unwatched" | "in_progress" | "watched";

export interface FranchiseTitleProgress {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  phaseId: string;
  phaseName: string;
  releaseOrder: number;
  chronologicalOrder: number;
  runtimeMinutes: number | null;
  status: FranchiseTitleStatus;
  progressPercent: number;
}

export interface FranchisePhaseProgress {
  id: string;
  name: string;
  totalTitles: number;
  watchedTitles: number;
  progressPercent: number;
}

export interface FranchiseProgress {
  slug: string;
  name: string;
  description: string;
  order: FranchiseOrder;
  totalTitles: number;
  watchedTitles: number;
  inProgressTitles: number;
  progressPercent: number;
  phases: FranchisePhaseProgress[];
  titles: FranchiseTitleProgress[];
  recommendedNext: FranchiseTitleProgress | null;
}
