import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";

export type MediaMappingProvider = "tv_time";
export type MediaMappingMediaType = "tv" | "movie";

export interface MediaMapping {
  provider: MediaMappingProvider;
  mediaType: MediaMappingMediaType;
  externalId: string;
  tmdbId: number;
  title: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface MediaMappingDocument {
  provider: MediaMappingProvider;
  mediaType: MediaMappingMediaType;
  externalId: string;
  tmdbId: number;
  title?: string | null;
  updatedBy?: string | null;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const mappingDocId = (
  provider: MediaMappingProvider,
  mediaType: MediaMappingMediaType,
  externalId: string,
) => `${provider}_${mediaType}_${externalId}`;

export const parseUpsertMediaMappingInput = (
  body: unknown,
): {
  provider: MediaMappingProvider;
  mediaType: MediaMappingMediaType;
  externalId: string;
  tmdbId: number;
  title: string | null;
} => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_import_payload");
  }

  const provider = body.provider === "tv_time" ? "tv_time" : null;
  const mediaType = body.mediaType === "movie" || body.mediaType === "tv" ? body.mediaType : null;
  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
  const tmdbId = Number(body.tmdbId);
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

  if (!provider || !mediaType || !externalId) {
    throw new HttpError(
      400,
      "provider, mediaType, and externalId are required.",
      "invalid_import_payload",
    );
  }

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new HttpError(400, "tmdbId must be a positive integer.", "invalid_import_payload");
  }

  return {provider, mediaType, externalId, tmdbId, title};
};

class MediaMappingService {
  private collection() {
    return getFirestore().collection("mediaMappings");
  }

  async get(
    provider: MediaMappingProvider,
    mediaType: MediaMappingMediaType,
    externalId: string,
  ): Promise<MediaMapping | null> {
    const snapshot = await this.collection().doc(mappingDocId(provider, mediaType, externalId)).get();
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data() as MediaMappingDocument;
    return {
      provider: data.provider,
      mediaType: data.mediaType,
      externalId: data.externalId,
      tmdbId: data.tmdbId,
      title: data.title ?? null,
      updatedBy: data.updatedBy ?? null,
      updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
    };
  }

  async upsert(
    userId: string,
    input: {
      provider: MediaMappingProvider;
      mediaType: MediaMappingMediaType;
      externalId: string;
      tmdbId: number;
      title: string | null;
    },
  ): Promise<MediaMapping> {
    const ref = this.collection().doc(mappingDocId(input.provider, input.mediaType, input.externalId));
    await ref.set(
      {
        provider: input.provider,
        mediaType: input.mediaType,
        externalId: input.externalId,
        tmdbId: input.tmdbId,
        title: input.title,
        updatedBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    const saved = await this.get(input.provider, input.mediaType, input.externalId);
    if (!saved) {
      throw new HttpError(500, "Media mapping could not be read after write.", "mapping_write_failed");
    }
    return saved;
  }
}

export const mediaMappingService = new MediaMappingService();
