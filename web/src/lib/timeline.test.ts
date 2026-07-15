import {describe, expect, it} from "vitest";
import {HistoryEntry} from "../types/history";
import {
  buildTimeline,
  filterTimelineEntries,
  fromWatchedAtInputValue,
  groupTimelineEntries,
  isRewatchEntry,
  toWatchedAtInputValue,
} from "./timeline";

const entry = (
  overrides: Partial<HistoryEntry> & Pick<HistoryEntry, "historyId" | "title" | "watchedAt">,
): HistoryEntry => ({
  tmdbId: 1001,
  mediaType: "tv",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  updatedAt: overrides.watchedAt,
  rewatchCount: 0,
  ...overrides,
});

describe("timeline", () => {
  const items = [
    entry({historyId: "tv_1_s01e01", title: "Show A", watchedAt: "2026-07-14T12:00:00.000Z", episodeTitle: "Pilot"}),
    entry({
      historyId: "tv_1_s01e02",
      title: "Show A",
      watchedAt: "2026-07-14T18:00:00.000Z",
      episodeNumber: 2,
      episodeTitle: "Next",
      rewatchCount: 1,
    }),
    entry({
      historyId: "movie_9",
      title: "Movie B",
      mediaType: "movie",
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
      watchedAt: "2026-06-01T10:00:00.000Z",
    }),
  ];

  it("filters by media type, search query, and rewatches", () => {
    expect(filterTimelineEntries(items, {mediaType: "movie", query: "", rewatchesOnly: false})).toHaveLength(1);
    expect(filterTimelineEntries(items, {mediaType: "all", query: "pilot", rewatchesOnly: false}).map((e) => e.historyId)).toEqual([
      "tv_1_s01e01",
    ]);
    expect(filterTimelineEntries(items, {mediaType: "all", query: "", rewatchesOnly: true})).toHaveLength(1);
    expect(isRewatchEntry(items[1])).toBe(true);
  });

  it("groups entries by day, month, and year", () => {
    const byDay = groupTimelineEntries(items, "day", "en-US");
    expect(byDay[0].entries).toHaveLength(2);
    expect(byDay[1].entries).toHaveLength(1);

    const byMonth = groupTimelineEntries(items, "month", "en-US");
    expect(byMonth).toHaveLength(2);

    const byYear = groupTimelineEntries(items, "year", "en-US");
    expect(byYear).toHaveLength(1);
    expect(byYear[0].key).toBe("2026");
  });

  it("builds a filtered timeline", () => {
    const timeline = buildTimeline(items, {mediaType: "tv", query: "", rewatchesOnly: false}, "day", "en-US");
    expect(timeline).toHaveLength(1);
    expect(timeline[0].entries).toHaveLength(2);
  });

  it("converts watchedAt values for date inputs", () => {
    const input = toWatchedAtInputValue("2026-07-14T12:30:00.000Z");
    expect(input).toMatch(/2026-07-14T/);
    expect(fromWatchedAtInputValue(input!)).toBeTruthy();
    expect(fromWatchedAtInputValue("not-a-date")).toBeNull();
  });
});
