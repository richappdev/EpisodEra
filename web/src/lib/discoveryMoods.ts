import {DiscoveryMood, MoodDefinition, StreamingProviderOption} from "../types/discovery";

export const discoveryMoods: MoodDefinition[] = [
  {id: "relaxing", label: "Something relaxing", genreIds: [35, 10751, 16], maxRuntimeMinutes: null},
  {id: "mind-bending", label: "Mind-bending", genreIds: [878, 9648, 53], maxRuntimeMinutes: null},
  {id: "emotional", label: "Emotional", genreIds: [18, 10749], maxRuntimeMinutes: null},
  {id: "epic", label: "Epic or action-heavy", genreIds: [28, 12, 14], maxRuntimeMinutes: null},
  {id: "quick-watch", label: "I have 30 minutes", genreIds: [], maxRuntimeMinutes: 30},
];

export const discoveryProviders: StreamingProviderOption[] = [
  {id: 8, name: "Netflix"},
  {id: 9, name: "Amazon Prime Video"},
  {id: 15, name: "Hulu"},
  {id: 337, name: "Disney+"},
  {id: 350, name: "Apple TV+"},
  {id: 1899, name: "Max"},
];

export const isDiscoveryMood = (value: string): value is DiscoveryMood =>
  discoveryMoods.some((mood) => mood.id === value);
