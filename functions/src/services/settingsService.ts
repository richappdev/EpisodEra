import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {SupportedLanguage, UserSettings, supportedLanguages} from "../models/settings";

interface SettingsDocument {
  language?: SupportedLanguage;
  updatedAt?: Timestamp;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage);

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

export const parseSettingsInput = (body: unknown): Pick<UserSettings, "language"> => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_settings_payload");
  }

  if (!isSupportedLanguage(body.language)) {
    throw new HttpError(400, "language must be en-US or zh-TW.", "unsupported_language");
  }

  return {language: body.language};
};

class SettingsService {
  private doc(userId: string) {
    return getFirestore().collection("users").doc(userId).collection("settings").doc("profile");
  }

  async get(userId: string): Promise<UserSettings> {
    const snapshot = await this.doc(userId).get();
    const data = snapshot.exists ? (snapshot.data() as SettingsDocument) : {};

    return {
      language: data.language ?? "en-US",
      updatedAt: timestampToJson(data.updatedAt),
    };
  }

  async update(userId: string, input: Pick<UserSettings, "language">): Promise<UserSettings> {
    await this.doc(userId).set(
      {
        language: input.language,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    return this.get(userId);
  }
}

export const settingsService = new SettingsService();
