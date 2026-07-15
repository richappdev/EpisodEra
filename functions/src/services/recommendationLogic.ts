import {DiscoveryMood, MoodDefinition, StreamingProviderOption} from "../models/discovery";
import {MediaSummary} from "../models/media";
import {FranchiseTitleProgress} from "../models/franchise";

export const streamingProviders: StreamingProviderOption[] = [
  {id: 8, name: "Netflix"},
  {id: 9, name: "Amazon Prime Video"},
  {id: 15, name: "Hulu"},
  {id: 337, name: "Disney+"},
  {id: 350, name: "Apple TV+"},
  {id: 1899, name: "Max"},
];

export const moodDefinitions: Record<DiscoveryMood, MoodDefinition> = {
  relaxing: {
    id: "relaxing",
    label: "Something relaxing",
    genreIds: [35, 10751, 16],
    maxRuntimeMinutes: null,
  },
  "mind-bending": {
    id: "mind-bending",
    label: "Mind-bending",
    genreIds: [878, 9648, 53],
    maxRuntimeMinutes: null,
  },
  emotional: {
    id: "emotional",
    label: "Emotional",
    genreIds: [18, 10749],
    maxRuntimeMinutes: null,
  },
  epic: {
    id: "epic",
    label: "Epic or action-heavy",
    genreIds: [28, 12, 14],
    maxRuntimeMinutes: null,
  },
  "quick-watch": {
    id: "quick-watch",
    label: "I have 30 minutes",
    genreIds: [],
    maxRuntimeMinutes: 30,
  },
};

export const isDiscoveryMood = (value: string): value is DiscoveryMood =>
  Object.prototype.hasOwnProperty.call(moodDefinitions, value);

export const parseProviderIds = (value: unknown): number[] => {
  if (value == null || value === "") {
    return [];
  }

  const raw = Array.isArray(value) ? value.map(String) : String(value).split(",");
  const ids = raw
    .map((entry) => Number(entry.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
};

export const titleMatchesProviders = (
  providerIds: number[] | undefined,
  preferredProviderIds: number[],
): boolean => {
  if (preferredProviderIds.length === 0) {
    return true;
  }
  if (!providerIds || providerIds.length === 0) {
    return true;
  }
  return providerIds.some((id) => preferredProviderIds.includes(id));
};

export const filterByRuntime = <T extends {runtimeMinutes?: number | null}>(
  items: T[],
  maxMinutes: number | null | undefined,
): T[] => {
  if (maxMinutes == null || maxMinutes <= 0) {
    return items;
  }
  return items.filter((item) => item.runtimeMinutes == null || item.runtimeMinutes <= maxMinutes);
};

export const dedupeMediaSummaries = (items: MediaSummary[]): MediaSummary[] => {
  const seen = new Set<string>();
  const results: MediaSummary[] = [];
  for (const item of items) {
    const key = `${item.mediaType}:${item.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results;
};

export const continueFranchiseSuggestions = (
  unfinished: FranchiseTitleProgress[],
  maxMinutes: number | null | undefined,
): FranchiseTitleProgress[] =>
  filterByRuntime(unfinished, maxMinutes).filter((item) => item.status !== "watched");
