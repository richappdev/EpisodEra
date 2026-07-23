import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {SupportedLanguage, UserSettings, supportedLanguages} from "../models/settings";

interface SettingsDocument {
  autoMarkPreviousEpisodesWatched?: boolean;
  language?: SupportedLanguage;
  preferredProviderIds?: number[];
  watchRegion?: string;
  achievementsEnabled?: boolean;
  showAchievementsOnProfile?: boolean;
  shareActivityWithFriends?: boolean;
  allowFriendRequests?: boolean;
  hideSpoilersUntilWatched?: boolean;
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

const parseBoolean = (value: unknown, field: string) => {
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${field} must be a boolean.`, `invalid_${field}`);
  }
  return value;
};

type SettingsUpdateInput = Partial<
  Pick<
    UserSettings,
    | "autoMarkPreviousEpisodesWatched"
    | "language"
    | "preferredProviderIds"
    | "watchRegion"
    | "achievementsEnabled"
    | "showAchievementsOnProfile"
    | "shareActivityWithFriends"
    | "allowFriendRequests"
    | "hideSpoilersUntilWatched"
  >
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
    input.autoMarkPreviousEpisodesWatched = parseBoolean(
      body.autoMarkPreviousEpisodesWatched,
      "autoMarkPreviousEpisodesWatched",
    );
  }

  if ("preferredProviderIds" in body) {
    input.preferredProviderIds = parseProviderIds(body.preferredProviderIds);
  }

  if ("watchRegion" in body) {
    input.watchRegion = parseWatchRegion(body.watchRegion);
  }

  if ("achievementsEnabled" in body) {
    input.achievementsEnabled = parseBoolean(body.achievementsEnabled, "achievementsEnabled");
  }

  if ("showAchievementsOnProfile" in body) {
    input.showAchievementsOnProfile = parseBoolean(body.showAchievementsOnProfile, "showAchievementsOnProfile");
  }

  if ("shareActivityWithFriends" in body) {
    input.shareActivityWithFriends = parseBoolean(body.shareActivityWithFriends, "shareActivityWithFriends");
  }

  if ("allowFriendRequests" in body) {
    input.allowFriendRequests = parseBoolean(body.allowFriendRequests, "allowFriendRequests");
  }

  if ("hideSpoilersUntilWatched" in body) {
    input.hideSpoilersUntilWatched = parseBoolean(body.hideSpoilersUntilWatched, "hideSpoilersUntilWatched");
  }

  if (Object.keys(input).length === 0) {
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
      achievementsEnabled: data.achievementsEnabled ?? true,
      showAchievementsOnProfile: data.showAchievementsOnProfile ?? true,
      shareActivityWithFriends: data.shareActivityWithFriends ?? false,
      allowFriendRequests: data.allowFriendRequests ?? true,
      hideSpoilersUntilWatched: data.hideSpoilersUntilWatched ?? true,
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

    const updated = await this.get(userId);
    const {shadowWrite} = await import("../migration/shadow");
    const {upsertSettingsShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "settings",
      operation: "upsert",
      firebaseUid: userId,
      operationId: `settings:upsert:${userId}:${Date.now()}`,
      payload: updated,
      secondary: () => upsertSettingsShadow(userId, updated),
    });
    return updated;
  }
}

export const settingsService = new SettingsService();
