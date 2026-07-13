import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {MediaType} from "../models/media";
import {HistoryEntry} from "../models/history";

interface HistoryDocument {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  watchedAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface MovieHistoryInput {
  tmdbId: number;
  title: string;
}

interface EpisodeHistoryInput {
  tmdbId: number;
  title: string;
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
}

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const mapDocument = (historyId: string, data: HistoryDocument): HistoryEntry => ({
  historyId,
  tmdbId: data.tmdbId,
  mediaType: data.mediaType,
  title: data.title,
  seasonNumber: data.seasonNumber,
  episodeNumber: data.episodeNumber,
  episodeTitle: data.episodeTitle,
  watchedAt: timestampToJson(data.watchedAt),
  updatedAt: timestampToJson(data.updatedAt),
});

class HistoryService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("history");
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<HistoryEntry>> {
    const baseQuery = this.collection(userId).orderBy("watchedAt", "desc");

    return listPaginated(baseQuery, pagination, (doc) =>
      mapDocument(doc.id, doc.data() as HistoryDocument),
    );
  }

  async recordMovie(userId: string, input: MovieHistoryInput): Promise<void> {
    await this.collection(userId).doc(`movie_${input.tmdbId}`).set(
      {
        tmdbId: input.tmdbId,
        mediaType: "movie",
        title: input.title,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }

  async removeMovie(userId: string, tmdbId: number): Promise<void> {
    await this.collection(userId).doc(`movie_${tmdbId}`).delete();
  }

  async recordEpisode(userId: string, input: EpisodeHistoryInput): Promise<void> {
    await this.collection(userId).doc(`tv_${input.tmdbId}_${input.episodeKey}`).set(
      {
        tmdbId: input.tmdbId,
        mediaType: "tv",
        title: input.title,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeTitle: input.episodeTitle,
        watchedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }

  async removeEpisode(userId: string, tmdbId: number, episodeKey: string): Promise<void> {
    await this.collection(userId).doc(`tv_${tmdbId}_${episodeKey}`).delete();
  }
}

export const historyService = new HistoryService();
