import assert from "node:assert/strict";
import test from "node:test";
import {EpisodeSummary, TvSeasonDetail} from "../models/media";
import {episodeKeyFor, findNextUnwatchedEpisode, progressPercentFor} from "./progressLogic";

const episode = (seasonNumber: number, episodeNumber: number): EpisodeSummary => ({
  id: seasonNumber * 100 + episodeNumber,
  episodeKey: episodeKeyFor(seasonNumber, episodeNumber),
  seasonNumber,
  episodeNumber,
  title: `Episode ${episodeNumber}`,
  overview: "",
  airDate: null,
  runtimeMinutes: null,
  still: null,
  voteAverage: 0,
});

const season = (seasonNumber: number, episodeCount: number): TvSeasonDetail => ({
  id: seasonNumber,
  tvId: 1,
  seasonNumber,
  title: `Season ${seasonNumber}`,
  overview: "",
  airDate: null,
  poster: null,
  episodeCount,
  episodes: Array.from({length: episodeCount}, (_, index) => episode(seasonNumber, index + 1)),
});

test("findNextUnwatchedEpisode returns the first canonical gap before later watched episodes", () => {
  const watched = new Set([episodeKeyFor(1, 1), episodeKeyFor(1, 3)]);

  assert.deepEqual(findNextUnwatchedEpisode([season(1, 3)], watched), {
    episodeKey: "s01e02",
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: "Episode 2",
  });
});

test("findNextUnwatchedEpisode advances across seasons", () => {
  const watched = new Set([episodeKeyFor(1, 1), episodeKeyFor(1, 2)]);

  assert.deepEqual(findNextUnwatchedEpisode([season(2, 1), season(1, 2)], watched), {
    episodeKey: "s02e01",
    seasonNumber: 2,
    episodeNumber: 1,
    episodeTitle: "Episode 1",
  });
});

test("progressPercentFor clamps precision to two decimals", () => {
  assert.equal(progressPercentFor(1, 3), 33.33);
});
