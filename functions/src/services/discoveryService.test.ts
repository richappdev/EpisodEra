import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {HttpError} from "../lib/httpError";
import {MediaDetail, MediaSummary} from "../models/media";
import {discoveryService, hydrateFranchiseTitle} from "./discoveryService";
import {tmdbService} from "./tmdbService";

const movieDetail: MediaDetail = {
  id: 1726,
  mediaType: "movie",
  title: "Iron Man",
  overview: "After being held captive...",
  releaseDate: "2008-05-02",
  voteAverage: 7.6,
  popularity: 100,
  images: {
    poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    backdrop: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
  },
  genres: [],
  runtimeMinutes: 126,
  status: "Released",
  originalLanguage: "en",
  homepage: null,
};

const movieSummary: MediaSummary = {
  id: 1726,
  mediaType: "movie",
  title: "Iron Man",
  overview: "After being held captive...",
  releaseDate: "2008-05-02",
  voteAverage: 7.6,
  popularity: 100,
  images: movieDetail.images,
};

const paged = (results: MediaSummary[], page = 1) => ({
  page,
  totalPages: 2,
  totalResults: results.length + 10,
  results,
});

describe("hydrateFranchiseTitle", () => {
  const originalMovieDetail = tmdbService.movieDetail;
  const originalTvDetail = tmdbService.tvDetail;

  afterEach(() => {
    tmdbService.movieDetail = originalMovieDetail;
    tmdbService.tvDetail = originalTvDetail;
  });

  it("returns TMDb metadata including poster for franchise titles", async () => {
    tmdbService.movieDetail = async () => movieDetail;

    const summary = await hydrateFranchiseTitle({
      tmdbId: 1726,
      mediaType: "movie",
      title: "Iron Man",
    });

    assert.equal(summary.id, 1726);
    assert.equal(summary.title, "Iron Man");
    assert.equal(summary.releaseDate, "2008-05-02");
    assert.equal(summary.voteAverage, 7.6);
    assert.equal(summary.images.poster, "https://image.tmdb.org/t/p/w500/poster.jpg");
  });

  it("falls back to a stub summary when TMDb lookup fails", async () => {
    tmdbService.tvDetail = async () => {
      throw new Error("TMDb unavailable");
    };

    const summary = await hydrateFranchiseTitle({
      tmdbId: 1399,
      mediaType: "tv",
      title: "Game of Thrones",
    });

    assert.deepEqual(summary, {
      id: 1399,
      mediaType: "tv",
      title: "Game of Thrones",
      overview: "",
      releaseDate: null,
      voteAverage: 0,
      popularity: 0,
      images: {poster: null, backdrop: null},
    });
  });
});

describe("discoveryService.list", () => {
  const originalDiscoverMovies = tmdbService.discoverMovies;
  const originalDiscoverTv = tmdbService.discoverTv;

  afterEach(() => {
    tmdbService.discoverMovies = originalDiscoverMovies;
    tmdbService.discoverTv = originalDiscoverTv;
  });

  it("returns a paginated mood list", async () => {
    tmdbService.discoverMovies = async () => paged([movieSummary], 2);
    tmdbService.discoverTv = async () => paged([], 2);

    const response = await discoveryService.list({} as never, "relaxing", {page: 2, language: "en-US"});

    assert.equal(response.id, "relaxing");
    assert.equal(response.title, "Something relaxing");
    assert.equal(response.page, 2);
    assert.equal(response.totalPages, 2);
    assert.equal(response.results[0]?.id, 1726);
  });

  it("rejects unknown list ids", async () => {
    await assert.rejects(
      () => discoveryService.list({} as never, "not-a-real-list", {}),
      (error: unknown) => error instanceof HttpError && error.status === 404,
    );
  });
});
