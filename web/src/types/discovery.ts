import {MediaSummary} from "./media";

export type DiscoveryMood = "relaxing" | "mind-bending" | "emotional" | "epic" | "quick-watch";

export interface MoodDefinition {
  id: DiscoveryMood;
  label: string;
  genreIds: number[];
  maxRuntimeMinutes: number | null;
}

export interface StreamingProviderOption {
  id: number;
  name: string;
}

export interface DiscoverySuggestionRail {
  id: string;
  title: string;
  reason: string;
  items: MediaSummary[];
}

export interface DiscoverySuggestionsResponse {
  mood: DiscoveryMood | null;
  maxMinutes: number | null;
  region: string;
  providerIds: number[];
  rails: DiscoverySuggestionRail[];
  moods: MoodDefinition[];
  providers: StreamingProviderOption[];
}

export interface DiscoveryListResponse {
  id: string;
  title: string;
  reason: string;
  page: number;
  totalPages: number;
  totalResults: number;
  results: MediaSummary[];
}
