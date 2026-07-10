export type MediaType = "movie" | "tv";

export interface ImageSet {
  poster: string | null;
  backdrop: string | null;
}

export interface MediaSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  releaseDate: string | null;
  voteAverage: number;
  popularity: number;
  images: ImageSet;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MediaDetail extends MediaSummary {
  genres: Genre[];
  runtimeMinutes: number | null;
  status: string | null;
  originalLanguage: string | null;
  homepage: string | null;
}

export interface EpisodeSummary {
  id: number;
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  airDate: string | null;
  runtimeMinutes: number | null;
  still: string | null;
  voteAverage: number;
}

export interface TvSeasonDetail {
  id: number;
  tvId: number;
  seasonNumber: number;
  title: string;
  overview: string;
  airDate: string | null;
  poster: string | null;
  episodeCount: number;
  episodes: EpisodeSummary[];
}

export interface PagedResult<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}
