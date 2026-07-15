import {HistoryEntry} from "../types/history";
import {MediaType} from "../types/media";

export type TimelineGroupMode = "day" | "month" | "year";

export interface TimelineFilters {
  mediaType: "all" | MediaType;
  query: string;
  rewatchesOnly: boolean;
}

export interface TimelineGroup {
  key: string;
  label: string;
  entries: HistoryEntry[];
}

const pad = (value: number) => String(value).padStart(2, "0");

export const historySortTime = (entry: HistoryEntry) => {
  const value = entry.watchedAt ?? entry.updatedAt;
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const isRewatchEntry = (entry: HistoryEntry) => (entry.rewatchCount ?? 0) > 0;

export const filterTimelineEntries = (entries: HistoryEntry[], filters: TimelineFilters) => {
  const query = filters.query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.mediaType !== "all" && entry.mediaType !== filters.mediaType) {
      return false;
    }

    if (filters.rewatchesOnly && !isRewatchEntry(entry)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      entry.title,
      entry.episodeTitle ?? "",
      entry.mediaType,
      entry.seasonNumber != null ? `s${entry.seasonNumber}` : "",
      entry.episodeNumber != null ? `e${entry.episodeNumber}` : "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
};

export const groupKeyForEntry = (entry: HistoryEntry, mode: TimelineGroupMode) => {
  const time = historySortTime(entry);
  if (!time) {
    return mode === "day" ? "unknown-day" : mode === "month" ? "unknown-month" : "unknown-year";
  }

  const date = new Date(time);
  // Group by UTC calendar buckets so ordering stays stable across locales.
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());

  if (mode === "year") {
    return String(year);
  }
  if (mode === "month") {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
};

export const groupLabelForKey = (key: string, mode: TimelineGroupMode, locale?: string) => {
  if (key.startsWith("unknown")) {
    return "Unknown date";
  }

  if (mode === "year") {
    return key;
  }

  if (mode === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {month: "long", year: "numeric", timeZone: "UTC"}).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  }

  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {dateStyle: "full", timeZone: "UTC"}).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
};

export const groupTimelineEntries = (
  entries: HistoryEntry[],
  mode: TimelineGroupMode,
  locale?: string,
): TimelineGroup[] => {
  const sorted = [...entries].sort((left, right) => historySortTime(right) - historySortTime(left));
  const groups = new Map<string, HistoryEntry[]>();

  for (const entry of sorted) {
    const key = groupKeyForEntry(entry, mode);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return [...groups.entries()].map(([key, groupEntries]) => ({
    key,
    label: groupLabelForKey(key, mode, locale),
    entries: groupEntries,
  }));
};

export const buildTimeline = (
  entries: HistoryEntry[],
  filters: TimelineFilters,
  mode: TimelineGroupMode,
  locale?: string,
) => groupTimelineEntries(filterTimelineEntries(entries, filters), mode, locale);

export const toWatchedAtInputValue = (isoDate: string | null) => {
  if (!isoDate) {
    return "";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromWatchedAtInputValue = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};
