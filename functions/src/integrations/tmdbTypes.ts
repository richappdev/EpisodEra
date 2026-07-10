export interface TmdbPagedResponse<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

export interface TmdbMediaBase {
  id: number;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  popularity?: number;
  media_type?: "movie" | "tv" | "person";
  genre_ids?: number[];
}

export interface TmdbMovie extends TmdbMediaBase {
  title?: string;
  release_date?: string;
}

export interface TmdbTv extends TmdbMediaBase {
  name?: string;
  first_air_date?: string;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieDetail extends TmdbMovie {
  genres?: TmdbGenre[];
  runtime?: number | null;
  status?: string | null;
  original_language?: string | null;
  homepage?: string | null;
}

export interface TmdbTvDetail extends TmdbTv {
  genres?: TmdbGenre[];
  episode_run_time?: number[];
  number_of_episodes?: number;
  seasons?: Array<{
    id: number;
    name?: string;
    season_number: number;
    episode_count?: number;
    air_date?: string | null;
    poster_path?: string | null;
  }>;
  status?: string | null;
  original_language?: string | null;
  homepage?: string | null;
}

export interface TmdbEpisode {
  id: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  episode_number: number;
  season_number: number;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number;
}

export interface TmdbTvSeasonDetail {
  id: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  poster_path?: string | null;
  season_number: number;
  episodes?: TmdbEpisode[];
}
