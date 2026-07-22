import {MediaType} from "./media";
import {PaginatedResponse} from "./pagination";

export interface LikedItem {
  itemId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  backdrop: string | null;
  likedAt: string | null;
}

export interface LikedResponse extends PaginatedResponse<LikedItem> {}

export interface AddLikedItemInput {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
}
