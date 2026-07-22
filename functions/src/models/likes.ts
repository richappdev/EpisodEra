import {MediaType} from "./media";

export interface LikedItem {
  itemId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  backdrop: string | null;
  likedAt: string | null;
}

export interface AddLikedItemInput {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
}
