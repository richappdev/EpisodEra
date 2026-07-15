import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {listPaginated, PaginatedResult, PaginationQuery} from "../lib/pagination";
import {
  BatchEpisodeProgressInput,
  EpisodeProgress,
  MarkEpisodeWatchedInput,
  ProgressEpisodePointer,
  ShowProgress,
  ShowProgressSummary,
} from "../models/progress";
import {MediaDetail, TvSeasonDetail} from "../models/media";
import {
  compareEpisodeCoordinates,
  episodeKeyFor,
  findNextUnwatchedEpisode,
  progressPercentFor,
  toEpisodePointer,
} from "./progressLogic";
import {tmdbService} from "./tmdbService";

interface ProgressDocument {
  tmdbId: number;
  title: string;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  nextEpisode?: ProgressEpisodePointer | null;
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

interface CanonicalProgressMetadata {
  tvDetail: MediaDetail;
  seasons: TvSeasonDetail[];
  episodesByKey: Map<string, ProgressEpisodePointer>;
  totalEpisodes: number;
}

const maxBatchEpisodeCount = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown, field: string) => {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, "invalid_progress_payload");
  }

  return numberValue;
};

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

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

export const parseEpisodeProgressInput = (body: unknown): MarkEpisodeWatchedInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_progress_payload");
  }

  return {
    seasonNumber: positiveInteger(body.seasonNumber, "seasonNumber"),
    episodeNumber: positiveInteger(body.episodeNumber, "episodeNumber"),
  };
};

export const parseBatchEpisodeProgressInput = (body: unknown): BatchEpisodeProgressInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_progress_payload");
  }

  if (typeof body.watched !== "boolean") {
    throw new HttpError(400, "watched must be a boolean.", "invalid_progress_payload");
  }

  if (!Array.isArray(body.episodes) || body.episodes.length === 0) {
    throw new HttpError(400, "episodes must be a non-empty array.", "invalid_progress_payload");
  }

  if (body.episodes.length > maxBatchEpisodeCount) {
    throw new HttpError(400, `episodes cannot contain more than ${maxBatchEpisodeCount} items.`, "batch_too_large");
  }

  const uniqueEpisodes = new Map<string, MarkEpisodeWatchedInput>();
  for (const episode of body.episodes) {
    const parsed = parseEpisodeProgressInput(episode);
    uniqueEpisodes.set(episodeKeyFor(parsed.seasonNumber, parsed.episodeNumber), parsed);
  }

  return {
    watched: body.watched,
    episodes: [...uniqueEpisodes.values()],
  };
};

class ProgressService {
  private collection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("progress");
  }

  private historyCollection(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("history");
  }

  async list(userId: string, pagination: PaginationQuery): Promise<PaginatedResult<ShowProgressSummary>> {
    const baseQuery = this.collection(userId).orderBy("updatedAt", "desc");

    return listPaginated(baseQuery, pagination, (doc) =>
      this.mapProgressSummary(doc.id, doc.data() as ProgressDocument),
    );
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
    return this.updateEpisodes(userId, showId, tmdbId, {
      watched: true,
      episodes: [input],
    });
  }

  async markUnwatched(
    userId: string,
    showId: string,
    tmdbId: number,
    input: MarkEpisodeWatchedInput,
  ): Promise<ShowProgress> {
    return this.updateEpisodes(userId, showId, tmdbId, {
      watched: false,
      episodes: [input],
    });
  }

  async updateEpisodes(
    userId: string,
    showId: string,
    tmdbId: number,
    input: BatchEpisodeProgressInput,
  ): Promise<ShowProgress> {
    const canonical = await this.loadCanonicalMetadata(tmdbId);
    const requested = input.episodes.map((episode) => {
      const episodeKey = episodeKeyFor(episode.seasonNumber, episode.episodeNumber);
      const metadata = canonical.episodesByKey.get(episodeKey);

      if (!metadata) {
        throw new HttpError(404, "Episode was not found for this show.", "episode_not_found");
      }

      return metadata;
    });

    const progressRef = this.collection(userId).doc(showId);
    const historyCollection = this.historyCollection(userId);

    await getFirestore().runTransaction(async (transaction) => {
      const existingEpisodesSnapshot = await transaction.get(progressRef.collection("episodes"));
      const finalEpisodeKeys = new Set(existingEpisodesSnapshot.docs.map((doc) => doc.id));
      const existingEpisodesByKey = new Map(existingEpisodesSnapshot.docs.map((doc) => [doc.id, doc]));

      for (const episode of requested) {
        const episodeRef = progressRef.collection("episodes").doc(episode.episodeKey);
        const historyRef = historyCollection.doc(`tv_${tmdbId}_${episode.episodeKey}`);

        if (input.watched) {
          const existing = existingEpisodesByKey.get(episode.episodeKey);
          const wasAlreadyWatched = Boolean(existing);
          finalEpisodeKeys.add(episode.episodeKey);
          transaction.set(
            episodeRef,
            {
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeTitle: episode.episodeTitle,
              watched: true,
              watchedAt: existing?.get("watchedAt") ?? FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          );
          const seasonEpisode = canonical.seasons
            .flatMap((season) => season.episodes)
            .find(
              (candidate) =>
                candidate.seasonNumber === episode.seasonNumber &&
                candidate.episodeNumber === episode.episodeNumber,
            );
          transaction.set(
            historyRef,
            {
              tmdbId,
              mediaType: "tv",
              title: canonical.tvDetail.title,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeTitle: episode.episodeTitle,
              watchedAt: existing?.get("watchedAt") ?? FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              rewatchCount: wasAlreadyWatched ? FieldValue.increment(1) : 0,
              genreNames: canonical.tvDetail.genres.map((genre) => genre.name),
              runtimeMinutes:
                seasonEpisode?.runtimeMinutes ?? canonical.tvDetail.runtimeMinutes ?? null,
            },
            {merge: true},
          );
        } else {
          finalEpisodeKeys.delete(episode.episodeKey);
          transaction.delete(episodeRef);
          transaction.delete(historyRef);
        }
      }

      const finalEpisodes = [...finalEpisodeKeys]
        .map((episodeKey) => canonical.episodesByKey.get(episodeKey))
        .filter((episode): episode is ProgressEpisodePointer => episode !== undefined)
        .sort(compareEpisodeCoordinates);
      const highestWatchedEpisode = finalEpisodes[finalEpisodes.length - 1] ?? null;
      const nextEpisode = findNextUnwatchedEpisode(canonical.seasons, finalEpisodeKeys);

      transaction.set(
        progressRef,
        {
          tmdbId,
          title: canonical.tvDetail.title,
          totalEpisodes: canonical.totalEpisodes,
          watchedEpisodeCount: finalEpisodes.length,
          progressPercent: progressPercentFor(finalEpisodes.length, canonical.totalEpisodes),
          currentSeason: highestWatchedEpisode?.seasonNumber ?? null,
          currentEpisode: highestWatchedEpisode?.episodeNumber ?? null,
          nextEpisode,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });

    const progress = await this.get(userId, showId);
    if (!progress) {
      throw new HttpError(500, "Progress could not be read after update.", "progress_update_failed");
    }

    return progress;
  }

  private async loadCanonicalMetadata(tmdbId: number): Promise<CanonicalProgressMetadata> {
    const tvDetail = await tmdbService.tvDetail(tmdbId);

    if (tvDetail.mediaType !== "tv") {
      throw new HttpError(400, "Progress can only be tracked for TV shows.", "invalid_media_type");
    }

    const seasonSummaries = (tvDetail.seasons ?? []).filter((season) => season.seasonNumber > 0);
    const seasons = await Promise.all(
      seasonSummaries.map((season) => tmdbService.tvSeasonDetail(tmdbId, season.seasonNumber)),
    );
    const episodesByKey = new Map<string, ProgressEpisodePointer>();

    for (const season of seasons) {
      for (const episode of season.episodes) {
        episodesByKey.set(episode.episodeKey, toEpisodePointer(episode));
      }
    }

    return {
      tvDetail,
      seasons,
      episodesByKey,
      totalEpisodes: tvDetail.totalEpisodes ?? episodesByKey.size,
    };
  }

  private mapProgressSummary(showId: string, data: ProgressDocument): ShowProgressSummary {
    return {
      showId,
      tmdbId: data.tmdbId,
      title: data.title,
      totalEpisodes: data.totalEpisodes,
      watchedEpisodeCount: data.watchedEpisodeCount,
      progressPercent: data.progressPercent,
      currentSeason: data.currentSeason,
      currentEpisode: data.currentEpisode,
      nextEpisode: data.nextEpisode ?? null,
      updatedAt: timestampToJson(data.updatedAt),
    };
  }

  private mapProgress(showId: string, data: ProgressDocument, episodes: EpisodeProgress[]): ShowProgress {
    const sortedEpisodes = [...episodes].sort(compareEpisodeCoordinates);

    return {
      ...this.mapProgressSummary(showId, data),
      episodes: sortedEpisodes,
    };
  }
}

export const progressService = new ProgressService();
