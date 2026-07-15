import {describe, expect, it} from "vitest";
import {progress, seasonDetail, tvDetail} from "../test/fixtures";
import {
  buildSeasonProgressSnapshots,
  DEFAULT_EPISODE_RUNTIME_MINUTES,
  formatWatchTime,
  previousEpisodesToMark,
  showProgressRemaining,
} from "./seasonProgress";

describe("seasonProgress", () => {
  it("formats watch time for minutes and hours", () => {
    expect(formatWatchTime(45)).toBe("45 min");
    expect(formatWatchTime(60)).toBe("1 hour");
    expect(formatWatchTime(120)).toBe("2 hours");
    expect(formatWatchTime(90)).toBe("1h 30m");
  });

  it("builds season snapshots with remaining time estimates", () => {
    const snapshots = buildSeasonProgressSnapshots(tvDetail.seasons!, progress, seasonDetail);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].seasonNumber).toBe(1);
    expect(snapshots[0].watchedCount).toBe(1);
    expect(snapshots[0].remainingCount).toBe(2);
    expect(snapshots[0].completed).toBe(false);
    expect(snapshots[0].progressPercent).toBeCloseTo(33.33);
    // Season detail lists E2 unwatched; E3 is missing from the payload so it uses the runtime default.
    expect(snapshots[0].estimatedRemainingMinutes).toBe(DEFAULT_EPISODE_RUNTIME_MINUTES * 2);
  });

  it("marks a completed season when every episode is watched", () => {
    const completed = {
      ...progress,
      watchedEpisodeCount: 3,
      progressPercent: 100,
      nextEpisode: null,
      episodes: [
        ...progress.episodes,
        {
          episodeKey: "s01e02",
          seasonNumber: 1,
          episodeNumber: 2,
          episodeTitle: "The Gap",
          watched: true,
          watchedAt: progress.episodes[0].watchedAt,
          updatedAt: progress.episodes[0].updatedAt,
        },
        {
          episodeKey: "s01e03",
          seasonNumber: 1,
          episodeNumber: 3,
          episodeTitle: "Finale",
          watched: true,
          watchedAt: progress.episodes[0].watchedAt,
          updatedAt: progress.episodes[0].updatedAt,
        },
      ],
    };

    const [season] = buildSeasonProgressSnapshots(tvDetail.seasons!, completed, null);
    expect(season.completed).toBe(true);
    expect(season.remainingCount).toBe(0);
  });

  it("selects previous episodes before the in-season next pointer", () => {
    const watchedKeys = new Set(["s01e01"]);
    const previous = previousEpisodesToMark(seasonDetail, watchedKeys, progress.nextEpisode);

    expect(previous.map((episode) => episode.episodeKey)).toEqual([]);
  });

  it("selects all available unwatched episodes when next episode is in a later season", () => {
    const watchedKeys = new Set(["s01e01"]);
    const previous = previousEpisodesToMark(seasonDetail, watchedKeys, {
      episodeKey: "s02e01",
      seasonNumber: 2,
      episodeNumber: 1,
      episodeTitle: "Next season",
    });

    expect(previous.map((episode) => episode.episodeKey)).toEqual(["s01e02"]);
  });

  it("computes show-level remaining counts", () => {
    expect(showProgressRemaining(progress)).toEqual({remainingCount: 2, remainingPercent: 66.67});
    expect(showProgressRemaining(null)).toEqual({remainingCount: 0, remainingPercent: 0});
  });
});
