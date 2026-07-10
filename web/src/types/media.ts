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

export interface PagedResult<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

export interface DiscoveryResponse {
  movies: PagedResult<MediaSummary>;
  tv: PagedResult<MediaSummary>;
}
