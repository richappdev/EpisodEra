import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {UserProfile} from "../models/profile";

interface ProfileDocument {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  country?: string | null;
  timezone?: string | null;
  friendCode?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

type ProfileUpdateInput = Partial<Pick<
  UserProfile,
  "firstName" | "lastName" | "displayName" | "photoURL" | "bio" | "country" | "timezone"
>>;

const optionalStringFields = ["displayName", "photoURL", "bio", "country", "timezone"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const timestampToJson = (value: Timestamp | undefined) =>
  value ? value.toDate().toISOString() : null;

const parseRequiredName = (value: unknown, field: "firstName" | "lastName") => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string.`, `invalid_${field}`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${field} is required.`, `missing_${field}`);
  }

  return trimmed;
};

const parseOptionalString = (value: unknown, field: (typeof optionalStringFields)[number]) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string or null.`, `invalid_${field}`);
  }

  const trimmed = value.trim();
  return trimmed || null;
};

export const parseProfileInput = (body: unknown): ProfileUpdateInput => {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object.", "invalid_profile_payload");
  }

  const input: ProfileUpdateInput = {};

  if ("firstName" in body) {
    input.firstName = parseRequiredName(body.firstName, "firstName");
  }

  if ("lastName" in body) {
    input.lastName = parseRequiredName(body.lastName, "lastName");
  }

  for (const field of optionalStringFields) {
    if (field in body) {
      input[field] = parseOptionalString(body[field], field);
    }
  }

  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "At least one supported profile field is required.", "missing_profile_fields");
  }

  return input;
};

class ProfileService {
  private doc(userId: string) {
    return getFirestore().collection("users").doc(userId);
  }

  private mapSupabaseRow(row: Record<string, unknown>): UserProfile {
    return {
      firstName: String(row.first_name ?? ""),
      lastName: String(row.last_name ?? ""),
      email: (row.email as string | null) ?? null,
      displayName: (row.display_name as string | null) ?? null,
      photoURL: (row.photo_url as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      country: (row.country as string | null) ?? null,
      timezone: (row.timezone as string | null) ?? null,
      friendCode: (row.friend_code as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
    };
  }

  /** Stubs from ensureProfileStubShadow — prefer Firestore until a real profile shadows. */
  private isProfileStub(row: Record<string, unknown>): boolean {
    const email = String(row.email ?? "");
    return (
      String(row.first_name ?? "") === "User" &&
      String(row.last_name ?? "") === "Unknown" &&
      email.endsWith("@users.firebase.local")
    );
  }

  async get(userId: string): Promise<UserProfile | null> {
    const {isSupabaseReadProfiles} = await import("../config/env");
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");
    if (isSupabaseReadProfiles()) {
      const env = getSupabaseEnvOrNull();
      if (env) {
        const rows = (await supabaseRest(
          env,
          `profiles?firebase_uid=eq.${encodeURIComponent(userId)}&select=*`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (row && !this.isProfileStub(row)) {
          return this.mapSupabaseRow(row);
        }
      }
    }

    const snapshot = await this.doc(userId).get();
    if (!snapshot.exists) {
      return null;
    }

    return this.toProfile(snapshot.data() as ProfileDocument);
  }

  async update(userId: string, email: string | undefined, input: ProfileUpdateInput): Promise<UserProfile> {
    const {isSupabaseWritePrimary, shouldPersistFirestore} = await import("../config/env");
    const ref = this.doc(userId);
    const snapshot = await ref.get();
    const existing = snapshot.exists ? (snapshot.data() as ProfileDocument) : null;
    const firstName = input.firstName ?? existing?.firstName;
    const lastName = input.lastName ?? existing?.lastName;

    if (!firstName) {
      throw new HttpError(400, "firstName is required.", "missing_firstName");
    }

    if (!lastName) {
      throw new HttpError(400, "lastName is required.", "missing_lastName");
    }

    const nextDisplayName = input.displayName ?? existing?.displayName ?? `${firstName} ${lastName}`.trim();
    const nextEmail = email ?? existing?.email ?? null;
    const nowIso = new Date().toISOString();
    const updated: UserProfile = {
      firstName,
      lastName,
      email: nextEmail,
      displayName: nextDisplayName,
      photoURL: input.photoURL !== undefined ? input.photoURL : (existing?.photoURL ?? null),
      bio: input.bio !== undefined ? input.bio : (existing?.bio ?? null),
      country: input.country !== undefined ? input.country : (existing?.country ?? null),
      timezone: input.timezone !== undefined ? input.timezone : (existing?.timezone ?? null),
      friendCode: existing?.friendCode ?? null,
      createdAt: timestampToJson(existing?.createdAt) ?? nowIso,
      updatedAt: nowIso,
    };

    if (shouldPersistFirestore()) {
      await ref.set(
        {
          ...input,
          firstName,
          lastName,
          displayName: nextDisplayName,
          email: nextEmail,
          updatedAt: FieldValue.serverTimestamp(),
          ...(snapshot.exists ? {} : {createdAt: FieldValue.serverTimestamp()}),
        },
        {merge: true},
      );
      const after = await ref.get();
      if (!after.exists) {
        throw new HttpError(500, "Could not load updated profile.", "profile_update_failed");
      }
      Object.assign(updated, this.toProfile(after.data() as ProfileDocument));
    }

    const {shadowWrite} = await import("../migration/shadow");
    const {upsertProfileShadow} = await import("../migration/supabaseWriters");
    if (isSupabaseWritePrimary()) {
      await upsertProfileShadow(userId, updated);
    } else {
      await shadowWrite({
        domain: "profiles",
        operation: "upsert",
        firebaseUid: userId,
        operationId: `profiles:upsert:${userId}:${Date.now()}`,
        payload: updated,
        secondary: () => upsertProfileShadow(userId, updated),
      });
    }

    return updated;
  }

  private toProfile(data: ProfileDocument): UserProfile {
    return {
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      bio: data.bio ?? null,
      country: data.country ?? null,
      timezone: data.timezone ?? null,
      friendCode: data.friendCode ?? null,
      createdAt: timestampToJson(data.createdAt),
      updatedAt: timestampToJson(data.updatedAt),
    };
  }
}

export const profileService = new ProfileService();
