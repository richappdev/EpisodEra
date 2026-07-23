import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  mapEpisode,
  mapMovieDetail,
  mapPaged,
  mapSummary,
  mapTvDetail,
  mapTvSeasonDetail,
} from "./tmdbMapper";

describe("tmdbMapper", () => {
  it("maps movie and TV summaries with fallbacks", () => {
    assert.equal(
      mapSummary({id: 1, original_title: "Original Movie"} as never, "movie").title,
      "Original Movie",
    );
    assert.equal(
      mapSummary({id: 2, original_name: "Original Show"} as never, "tv").title,
      "Original Show",
    );
    assert.deepEqual(
      mapPaged(
        {
          page: 1,
          total_pages: 2,
          total_results: 1,
          results: [{id: 3, name: "Show"}],
        } as never,
        "tv",
      ),
      {
        page: 1,
        totalPages: 2,
        totalResults: 1,
        results: [
          {
            id: 3,
            mediaType: "tv",
            title: "Show",
            overview: "",
            releaseDate: null,
            voteAverage: 0,
            popularity: 0,
            images: {poster: null, backdrop: null},
          },
        ],
      },
    );
  });

  it("maps movie and TV details", () => {
    const movie = mapMovieDetail({
      id: 550,
      title: "Fight Club",
      genres: [{id: 18, name: "Drama"}],
      runtime: 139,
    } as never);
    assert.equal(movie.runtimeMinutes, 139);
    assert.deepEqual(movie.genres, [{id: 18, name: "Drama"}]);

    const tv = mapTvDetail({
      id: 95396,
      name: "Severance",
      episode_run_time: [50],
      number_of_episodes: 19,
      seasons: [
        {id: 10, season_number: 0, name: "Specials"},
        {id: 11, season_number: 1, episode_count: 9, poster_path: "/season.jpg"},
      ],
    } as never);
    assert.equal(tv.runtimeMinutes, 50);
    assert.equal(tv.totalEpisodes, 19);
    assert.deepEqual(tv.seasons, [
      {
        id: 11,
        seasonNumber: 1,
        title: "Season 1",
        episodeCount: 9,
        airDate: null,
        poster: "https://image.tmdb.org/t/p/w500/season.jpg",
      },
    ]);
  });

  it("maps episodes and season details", () => {
    const episode = mapEpisode({
      id: 20,
      season_number: 1,
      episode_number: 2,
      name: "Half Loop",
      still_path: "/still.jpg",
    } as never);
    assert.equal(episode.episodeKey, "s01e02");
    assert.equal(episode.still, "https://image.tmdb.org/t/p/w300/still.jpg");

    const season = mapTvSeasonDetail(95396, {
      id: 11,
      season_number: 1,
      name: "Season One",
      episodes: [
        {
          id: 20,
          season_number: 1,
          episode_number: 2,
          name: "Half Loop",
        },
      ],
    } as never);
    assert.equal(season.tvId, 95396);
    assert.equal(season.episodeCount, 1);
    assert.equal(season.episodes[0]?.episodeKey, "s01e02");
  });
});
