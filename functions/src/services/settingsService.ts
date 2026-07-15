import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {SupportedLanguage, UserSettings, supportedLanguages} from "../models/settings";

interface SettingsDocument {
  autoMarkPreviousEpisodesWatched?: boolean;
  language?: SupportedLanguage;
  preferredProviderIds?: number[];
  watchRegion?: string;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage);

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const parseProviderIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "preferredProviderIds must be an array of positive integers.", "invalid_providers");
  }

  const ids = value
    .map((entry) => Number(entry))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length !== value.length) {
    throw new HttpError(400, "preferredProviderIds must be an array of positive integers.", "invalid_providers");
  }

  return [...new Set(ids)].slice(0, 12);
};

const parseWatchRegion = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z]{2}$/.test(value)) {
    throw new HttpError(400, "watchRegion must be a 2-letter country code.", "invalid_watch_region");
  }
  return value.toUpperCase();
};

type SettingsUpdateInput = Partial<
  Pick<UserSettings, "autoMarkPreviousEpisodesWatched" | "language" | "preferredProviderIds" | "watchRegion">
>;

export const parseSettingsInput = (body: unknown): SettingsUpdateInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_settings_payload");
  }

  const input: SettingsUpdateInput = {};

  if ("language" in body) {
    if (!isSupportedLanguage(body.language)) {
      throw new HttpError(400, "language must be en-US or zh-TW.", "unsupported_language");
    }

    input.language = body.language;
  }

  if ("autoMarkPreviousEpisodesWatched" in body) {
    if (typeof body.autoMarkPreviousEpisodesWatched !== "boolean") {
      throw new HttpError(
        400,
        "autoMarkPreviousEpisodesWatched must be a boolean.",
        "invalid_auto_mark_previous_episodes_watched",
      );
    }

    input.autoMarkPreviousEpisodesWatched = body.autoMarkPreviousEpisodesWatched;
  }

  if ("preferredProviderIds" in body) {
    input.preferredProviderIds = parseProviderIds(body.preferredProviderIds);
  }

  if ("watchRegion" in body) {
    input.watchRegion = parseWatchRegion(body.watchRegion);
  }

  if (
    !("language" in input) &&
    !("autoMarkPreviousEpisodesWatched" in input) &&
    !("preferredProviderIds" in input) &&
    !("watchRegion" in input)
  ) {
    throw new HttpError(400, "At least one supported setting is required.", "missing_settings");
  }

  return input;
};

class SettingsService {
  private doc(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("settings").doc("profile");
  }

  async get(userId: string): Promise<UserSettings> {
    const snapshot = await this.doc(userId).get();
    const data = snapshot.exists ? (snapshot.data() as SettingsDocument) : {};

    return {
      autoMarkPreviousEpisodesWatched: data.autoMarkPreviousEpisodesWatched ?? false,
      language: data.language ?? "en-US",
      preferredProviderIds: Array.isArray(data.preferredProviderIds)
        ? data.preferredProviderIds.filter((id): id is number => Number.isInteger(id) && id > 0)
        : [],
      watchRegion:
        typeof data.watchRegion === "string" && /^[A-Za-z]{2}$/.test(data.watchRegion)
          ? data.watchRegion.toUpperCase()
          : "US",
      updatedAt: timestampToJson(data.updatedAt),
    };
  }

  async update(userId: string, input: SettingsUpdateInput): Promise<UserSettings> {
    await this.doc(userId).set(
      {
        ...input,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    return this.get(userId);
  }
}

export const settingsService = new SettingsService();
