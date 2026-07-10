import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {EpisodeProgress, MarkEpisodeWatchedInput, ShowProgress} from "../models/progress";

interface ProgressDocument {
  tmdbId: number;
  title: string;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  updatedAt?: Timestamp;
}

interface EpisodeProgressDocument {
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  watched: boolean;
  watchedAt?: Timestamp;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown, field: string) => {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, "invalid_progress_payload");
  }

  return numberValue;
};

const requiredString = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} is required.`, "invalid_progress_payload");
  }

  return value.trim();
};

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const episodeKeyFor = (seasonNumber: number, episodeNumber: number) =>
  `s${String(seasonNumber).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}`;

const progressPercentFor = (watchedEpisodeCount: number, totalEpisodes: number) =>
  totalEpisodes > 0 ? Math.round((watchedEpisodeCount / totalEpisodes) * 10000) / 100 : 0;

const compareEpisodes = (left: EpisodeProgress, right: EpisodeProgress) => {
  if (left.seasonNumber !== right.seasonNumber) {
    return left.seasonNumber - right.seasonNumber;
  }

  return left.episodeNumber - right.episodeNumber;
};

const mapEpisodeDocument = (episodeKey: string, data: EpisodeProgressDocument): EpisodeProgress => ({
  episodeKey,
  seasonNumber: data.seasonNumber,
  episodeNumber: data.episodeNumber,
  episodeTitle: data.episodeTitle,
  watched: data.watched,
  watchedAt: timestampToJson(data.watchedAt),
  updatedAt: timestampToJson(data.updatedAt),
});

export const parseShowId = (value: string) => {
  const tmdbId = Number(value);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new HttpError(400, "Show id must be a positive TMDb id.", "invalid_show_id");
  }

  return {
    showId: String(tmdbId),
    tmdbId,
  };
};

export const parseMarkEpisodeWatchedInput = (body: unknown): MarkEpisodeWatchedInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_progress_payload");
  }

  return {
    seasonNumber: positiveInteger(body.seasonNumber, "seasonNumber"),
    episodeNumber: positiveInteger(body.episodeNumber, "episodeNumber"),
    episodeTitle: requiredString(body.episodeTitle, "episodeTitle"),
    totalEpisodes: positiveInteger(body.totalEpisodes, "totalEpisodes"),
    title: requiredString(body.title, "title"),
  };
};

class ProgressService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("progress");
  }

  async get(userId: string, showId: string): Promise<ShowProgress | null> {
    const progressRef = this.collection(userId).doc(showId);
    const progressSnapshot = await progressRef.get();

    if (!progressSnapshot.exists) {
      return null;
    }

    const episodesSnapshot = await progressRef.collection("episodes").get();
    const episodes = episodesSnapshot.docs.map((doc) =>
      mapEpisodeDocument(doc.id, doc.data() as EpisodeProgressDocument),
    );

    return this.mapProgress(showId, progressSnapshot.data() as ProgressDocument, episodes);
  }

  async markWatched(userId: string, showId: string, tmdbId: number, input: MarkEpisodeWatchedInput): Promise<ShowProgress> {
    const progressRef = this.collection(userId).doc(showId);
    const episodeKey = episodeKeyFor(input.seasonNumber, input.episodeNumber);
    const episodeRef = progressRef.collection("episodes").doc(episodeKey);

    await episodeRef.set(
      {
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeTitle: input.episodeTitle,
        watched: true,
        watchedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    await this.refreshProgress(progressRef, tmdbId, input.title, input.totalEpisodes);

    const progress = await this.get(userId, showId);
    if (!progress) {
      throw new HttpError(500, "Progress could not be read after update.", "progress_update_failed");
    }

    return progress;
  }

  async markUnwatched(userId: string, showId: string, tmdbId: number, episodeKey: string): Promise<ShowProgress | null> {
    if (!/^s\d{2,}e\d{2,}$/.test(episodeKey)) {
      throw new HttpError(400, "Episode key must look like s01e01.", "invalid_episode_key");
    }

    const progressRef = this.collection(userId).doc(showId);
    const progressSnapshot = await progressRef.get();

    if (!progressSnapshot.exists) {
      return null;
    }

    await progressRef.collection("episodes").doc(episodeKey).delete();

    const data = progressSnapshot.data() as ProgressDocument;
    await this.refreshProgress(progressRef, tmdbId, data.title, data.totalEpisodes);

    return this.get(userId, showId);
  }

  private async refreshProgress(
    progressRef: FirebaseFirestore.DocumentReference,
    tmdbId: number,
    title: string,
    totalEpisodes: number,
  ) {
    const episodesSnapshot = await progressRef.collection("episodes").get();
    const episodes = episodesSnapshot.docs.map((doc) =>
      mapEpisodeDocument(doc.id, doc.data() as EpisodeProgressDocument),
    );
    const current = episodes.length > 0 ? episodes[episodes.length - 1] : null;

    await progressRef.set(
      {
        tmdbId,
        title,
        totalEpisodes,
        watchedEpisodeCount: episodes.length,
        progressPercent: progressPercentFor(episodes.length, totalEpisodes),
        currentSeason: current?.seasonNumber ?? null,
        currentEpisode: current?.episodeNumber ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }

  private mapProgress(showId: string, data: ProgressDocument, episodes: EpisodeProgress[]): ShowProgress {
    const sortedEpisodes = [...episodes].sort(compareEpisodes);

    return {
      showId,
      tmdbId: data.tmdbId,
      title: data.title,
      totalEpisodes: data.totalEpisodes,
      watchedEpisodeCount: data.watchedEpisodeCount,
      progressPercent: data.progressPercent,
      currentSeason: data.currentSeason,
      currentEpisode: data.currentEpisode,
      updatedAt: timestampToJson(data.updatedAt),
      episodes: sortedEpisodes,
    };
  }
}

export const progressService = new ProgressService();
