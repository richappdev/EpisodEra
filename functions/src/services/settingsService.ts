import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {SupportedLanguage, UserSettings, supportedLanguages} from "../models/settings";

interface SettingsDocument {
  autoMarkPreviousEpisodesWatched?: boolean;
  language?: SupportedLanguage;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage);

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

type SettingsUpdateInput = Partial<Pick<UserSettings, "autoMarkPreviousEpisodesWatched" | "language">>;

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

  if (!("language" in input) && !("autoMarkPreviousEpisodesWatched" in input)) {
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
      updatedAt: timestampToJson(data.updatedAt),
    };
  }

  async update(
    userId: string,
    input: SettingsUpdateInput,
  ): Promise<UserSettings> {
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
