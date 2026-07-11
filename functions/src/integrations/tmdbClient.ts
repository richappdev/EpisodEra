import {tmdbApiKey, tmdbBaseUrl} from "../config/env";
import {HttpError} from "../lib/httpError";
import {MediaDetail, MediaSummary, PagedResult, TvSeasonDetail} from "../models/media";
import {SupportedLanguage} from "../models/settings";
import {mapMovieDetail, mapPaged, mapTvDetail, mapTvSeasonDetail} from "./tmdbMapper";
import {
  TmdbMovie,
  TmdbMovieDetail,
  TmdbPagedResponse,
  TmdbTv,
  TmdbTvDetail,
  TmdbTvSeasonDetail,
} from "./tmdbTypes";

type QueryValue = string | number | boolean | undefined;

export class TmdbClient {
  async search(query: string, page = 1, language: SupportedLanguage = "en-US"): Promise<{
    movies: PagedResult<MediaSummary>;
    tv: PagedResult<MediaSummary>;
  }> {
    const [movies, tv] = await Promise.all([
      this.get<TmdbPagedResponse<TmdbMovie>>("/search/movie", {query, page, language}),
      this.get<TmdbPagedResponse<TmdbTv>>("/search/tv", {query, page, language}),
    ]);

    return {
      movies: mapPaged(movies, "movie"),
      tv: mapPaged(tv, "tv"),
    };
  }

  async trending(page = 1, language: SupportedLanguage = "en-US"): Promise<{
    movies: PagedResult<MediaSummary>;
    tv: PagedResult<MediaSummary>;
  }> {
    const [movies, tv] = await Promise.all([this.trendingMovies(page, language), this.trendingTv(page, language)]);

    return {
      movies,
      tv,
    };
  }

  async trendingMovies(page = 1, language: SupportedLanguage = "en-US"): Promise<PagedResult<MediaSummary>> {
    return mapPaged(await this.get<TmdbPagedResponse<TmdbMovie>>("/trending/movie/week", {page, language}), "movie");
  }

  async trendingTv(page = 1, language: SupportedLanguage = "en-US"): Promise<PagedResult<MediaSummary>> {
    return mapPaged(await this.get<TmdbPagedResponse<TmdbTv>>("/trending/tv/week", {page, language}), "tv");
  }

  async movieDetail(id: number, language: SupportedLanguage = "en-US"): Promise<MediaDetail> {
    return mapMovieDetail(await this.get<TmdbMovieDetail>(`/movie/${id}`, {language}));
  }

  async tvDetail(id: number, language: SupportedLanguage = "en-US"): Promise<MediaDetail> {
    return mapTvDetail(await this.get<TmdbTvDetail>(`/tv/${id}`, {language}));
  }

  async tvSeasonDetail(
    id: number,
    seasonNumber: number,
    language: SupportedLanguage = "en-US",
  ): Promise<TvSeasonDetail> {
    return mapTvSeasonDetail(id, await this.get<TmdbTvSeasonDetail>(`/tv/${id}/season/${seasonNumber}`, {language}));
  }

  private async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = new URL(`${tmdbBaseUrl}${path}`);
    url.searchParams.set("api_key", tmdbApiKey.value());

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new HttpError(502, `TMDb request failed for ${path}`, "tmdb_request_failed");
    }

    return response.json() as Promise<T>;
  }
}
