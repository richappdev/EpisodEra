import {tmdbImageBaseUrl} from "../config/env";
import {MediaDetail, MediaSummary, MediaType, PagedResult} from "../models/media";
import {
  TmdbMovie,
  TmdbMovieDetail,
  TmdbPagedResponse,
  TmdbTv,
  TmdbTvDetail,
} from "./tmdbTypes";

const imageUrl = (path: string | null | undefined, size: string) =>
  path ? `${tmdbImageBaseUrl}/${size}${path}` : null;

const titleFor = (item: TmdbMovie | TmdbTv, mediaType: MediaType) =>
  mediaType === "movie" ? (item as TmdbMovie).title ?? "" : (item as TmdbTv).name ?? "";

const dateFor = (item: TmdbMovie | TmdbTv, mediaType: MediaType) =>
  mediaType === "movie" ? (item as TmdbMovie).release_date ?? null : (item as TmdbTv).first_air_date ?? null;

export const mapSummary = (item: TmdbMovie | TmdbTv, mediaType: MediaType): MediaSummary => ({
  id: item.id,
  mediaType,
  title: titleFor(item, mediaType),
  overview: item.overview ?? "",
  releaseDate: dateFor(item, mediaType),
  voteAverage: item.vote_average ?? 0,
  popularity: item.popularity ?? 0,
  images: {
    poster: imageUrl(item.poster_path, "w500"),
    backdrop: imageUrl(item.backdrop_path, "w780"),
  },
});

export const mapPaged = <T extends TmdbMovie | TmdbTv>(
  payload: TmdbPagedResponse<T>,
  mediaType: MediaType,
): PagedResult<MediaSummary> => ({
  page: payload.page,
  totalPages: payload.total_pages,
  totalResults: payload.total_results,
  results: payload.results.map((item) => mapSummary(item, mediaType)),
});

export const mapMovieDetail = (item: TmdbMovieDetail): MediaDetail => ({
  ...mapSummary(item, "movie"),
  genres: item.genres ?? [],
  runtimeMinutes: item.runtime ?? null,
  status: item.status ?? null,
  originalLanguage: item.original_language ?? null,
  homepage: item.homepage ?? null,
});

export const mapTvDetail = (item: TmdbTvDetail): MediaDetail => ({
  ...mapSummary(item, "tv"),
  genres: item.genres ?? [],
  runtimeMinutes: item.episode_run_time?.[0] ?? null,
  status: item.status ?? null,
  originalLanguage: item.original_language ?? null,
  homepage: item.homepage ?? null,
});
