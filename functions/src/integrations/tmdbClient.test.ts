import assert from "node:assert/strict";
import test from "node:test";
import {TmdbClient} from "./tmdbClient";

const tvDetailResponse = {
  id: 95396,
  name: "Severance",
  overview: "",
  first_air_date: "2022-02-17",
  vote_average: 8.4,
  popularity: 100,
  poster_path: null,
  backdrop_path: null,
  genres: [],
  episode_run_time: [50],
  status: "Returning Series",
  original_language: "en",
  homepage: null,
  number_of_episodes: 1,
  seasons: [
    {
      id: 1,
      season_number: 1,
      name: "Season 1",
      episode_count: 1,
      air_date: null,
      poster_path: null,
    },
  ],
};

const seasonResponse = {
  id: 1,
  season_number: 1,
  name: "Season 1",
  overview: "",
  air_date: null,
  poster_path: null,
  episodes: [
    {
      id: 101,
      season_number: 1,
      episode_number: 1,
      name: "Good News About Hell",
      overview: "",
      air_date: null,
      runtime: null,
      still_path: null,
      vote_average: 0,
    },
  ],
};

test("TmdbClient caches stable TV and season metadata by path and language", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TMDB_API_KEY;
  let fetchCount = 0;
  process.env.TMDB_API_KEY = "test-api-key";
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCount += 1;
    const url = String(input);
    const payload = url.includes("/season/") ? seasonResponse : tvDetailResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {"Content-Type": "application/json"},
    });
  }) as typeof fetch;

  try {
    const client = new TmdbClient();

    const firstDetail = await client.tvDetail(95396);
    const secondDetail = await client.tvDetail(95396);
    const firstSeason = await client.tvSeasonDetail(95396, 1);
    const secondSeason = await client.tvSeasonDetail(95396, 1);

    assert.equal(firstDetail.title, "Severance");
    assert.equal(secondDetail.title, "Severance");
    assert.equal(firstSeason.episodes[0].title, "Good News About Hell");
    assert.equal(secondSeason.episodes[0].title, "Good News About Hell");
    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TMDB_API_KEY = originalApiKey;
  }
});

test("TmdbClient clearCache forces the next request to refetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TMDB_API_KEY;
  let fetchCount = 0;
  process.env.TMDB_API_KEY = "test-api-key";
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(JSON.stringify(tvDetailResponse), {
      status: 200,
      headers: {"Content-Type": "application/json"},
    });
  }) as typeof fetch;

  try {
    const client = new TmdbClient();

    await client.tvDetail(95396);
    client.clearCache();
    await client.tvDetail(95396);

    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TMDB_API_KEY = originalApiKey;
  }
});
