import {tmdbImageBaseUrl} from "../config/env";
import {EpisodeSummary, MediaDetail, MediaSummary, MediaType, PagedResult, TvSeasonDetail} from "../models/media";
import {
  TmdbEpisode,
  TmdbMovie,
  TmdbMovieDetail,
  TmdbPagedResponse,
  TmdbTv,
  TmdbTvDetail,
  TmdbTvSeasonDetail,
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

const episodeKeyFor = (seasonNumber: number, episodeNumber: number) =>
  `s${String(seasonNumber).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}`;

export const mapEpisode = (item: TmdbEpisode): EpisodeSummary => ({
  id: item.id,
  episodeKey: episodeKeyFor(item.season_number, item.episode_number),
  seasonNumber: item.season_number,
  episodeNumber: item.episode_number,
  title: item.name ?? "",
  overview: item.overview ?? "",
  airDate: item.air_date ?? null,
  runtimeMinutes: item.runtime ?? null,
  still: imageUrl(item.still_path, "w300"),
  voteAverage: item.vote_average ?? 0,
});

export const mapTvSeasonDetail = (tvId: number, item: TmdbTvSeasonDetail): TvSeasonDetail => {
  const episodes = item.episodes?.map(mapEpisode) ?? [];

  return {
    id: item.id,
    tvId,
    seasonNumber: item.season_number,
    title: item.name ?? "",
    overview: item.overview ?? "",
    airDate: item.air_date ?? null,
    poster: imageUrl(item.poster_path, "w500"),
    episodeCount: episodes.length,
    episodes,
  };
};
