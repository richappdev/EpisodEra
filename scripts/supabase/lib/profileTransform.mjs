/** Pure Firestore → Postgres row mappers for profile backfill. */

export function toIso(value) {
  if (!value) {
    return null;
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

export function normalizeCountry(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

export function normalizeFriendCode(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(trimmed) ? trimmed : null;
}

export function jsonSafe(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (entry && typeof entry.toDate === "function") {
        return entry.toDate().toISOString();
      }
      return entry;
    }),
  );
}

export function mapProfileRow(uid, data, authEmail) {
  const firstName =
    typeof data.firstName === "string" && data.firstName.trim()
      ? data.firstName.trim()
      : "User";
  const lastName =
    typeof data.lastName === "string" && data.lastName.trim()
      ? data.lastName.trim()
      : "Unknown";
  const emailCandidate =
    (typeof data.email === "string" && data.email.trim()) ||
    (typeof authEmail === "string" && authEmail.trim()) ||
    `${uid}@users.firebase.local`;

  return {
    firebase_uid: uid,
    first_name: firstName,
    last_name: lastName,
    display_name:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : `${firstName} ${lastName}`.trim(),
    email: emailCandidate,
    photo_url:
      typeof data.photoURL === "string" && data.photoURL.trim() ? data.photoURL.trim() : null,
    bio: typeof data.bio === "string" && data.bio.trim() ? data.bio.trim() : null,
    country: normalizeCountry(data.country),
    timezone:
      typeof data.timezone === "string" && data.timezone.trim() ? data.timezone.trim() : null,
    friend_code: normalizeFriendCode(data.friendCode),
    created_at: toIso(data.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

export function mapSettingsRow(uid, data) {
  const raw = jsonSafe(data ?? {}) ?? {};
  return {
    firebase_uid: uid,
    locale: typeof raw.language === "string" ? raw.language : null,
    theme: null,
    spoiler_mode:
      raw.hideSpoilersUntilWatched === true
        ? "until_watched"
        : raw.hideSpoilersUntilWatched === false
          ? "off"
          : null,
    notification_prefs: {},
    raw,
    updated_at: toIso(data?.updatedAt) ?? new Date().toISOString(),
  };
}
