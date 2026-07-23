import {getSupabaseEnvOrNull, supabaseRest, supabaseRpc} from "../db/supabaseClient";
import {UserProfile} from "../models/profile";
import {UserSettings} from "../models/settings";
import {WatchlistItem} from "../models/watchlist";
import {LikedItem} from "../models/likes";

const upsert = async (table: string, onConflict: string, rows: unknown[]) => {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRest(env, `${table}?on_conflict=${onConflict}`, {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
};

const removeEq = async (table: string, filters: string) => {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRest(env, `${table}?${filters}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
};

export async function upsertIdentityMapping(firebaseUid: string, email: string | null): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRpc(env, "upsert_identity_mapping", {
    p_firebase_uid: firebaseUid,
    p_email: email,
  });
}

export async function upsertProfileShadow(firebaseUid: string, profile: UserProfile): Promise<void> {
  await upsert("profiles", "firebase_uid", [
    {
      firebase_uid: firebaseUid,
      first_name: profile.firstName || "User",
      last_name: profile.lastName || "Unknown",
      display_name: profile.displayName,
      email: profile.email || `${firebaseUid}@users.firebase.local`,
      photo_url: profile.photoURL,
      bio: profile.bio,
      country:
        typeof profile.country === "string" && /^[A-Za-z]{2}$/.test(profile.country)
          ? profile.country.toUpperCase()
          : null,
      timezone: profile.timezone,
      friend_code:
        typeof profile.friendCode === "string" && /^[A-Z0-9]{6}$/i.test(profile.friendCode)
          ? profile.friendCode.toUpperCase()
          : null,
      created_at: profile.createdAt ?? new Date().toISOString(),
      updated_at: profile.updatedAt ?? new Date().toISOString(),
    },
  ]);
  await upsertIdentityMapping(firebaseUid, profile.email);
}

export async function upsertSettingsShadow(firebaseUid: string, settings: UserSettings): Promise<void> {
  await upsert("user_settings", "firebase_uid", [
    {
      firebase_uid: firebaseUid,
      locale: settings.language,
      theme: null,
      spoiler_mode: settings.hideSpoilersUntilWatched ? "until_watched" : "off",
      notification_prefs: {},
      raw: {
        autoMarkPreviousEpisodesWatched: settings.autoMarkPreviousEpisodesWatched,
        language: settings.language,
        preferredProviderIds: settings.preferredProviderIds,
        watchRegion: settings.watchRegion,
        achievementsEnabled: settings.achievementsEnabled,
        showAchievementsOnProfile: settings.showAchievementsOnProfile,
        shareActivityWithFriends: settings.shareActivityWithFriends,
        allowFriendRequests: settings.allowFriendRequests,
        hideSpoilersUntilWatched: settings.hideSpoilersUntilWatched,
      },
      updated_at: settings.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

export async function upsertWatchlistShadow(firebaseUid: string, item: WatchlistItem): Promise<void> {
  await upsert("watchlist_items", "firebase_uid,media_type,tmdb_id", [
    {
      firebase_uid: firebaseUid,
      tmdb_id: item.tmdbId,
      media_type: item.mediaType,
      title: item.title,
      poster_path: item.poster,
      backdrop_path: item.backdrop,
      status: item.status,
      added_at: item.addedAt ?? new Date().toISOString(),
      updated_at: item.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

export async function removeWatchlistShadow(
  firebaseUid: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<void> {
  await removeEq(
    "watchlist_items",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&media_type=eq.${mediaType}&tmdb_id=eq.${tmdbId}`,
  );
}

export async function upsertLikeShadow(firebaseUid: string, item: LikedItem): Promise<void> {
  await upsert("likes", "firebase_uid,media_type,tmdb_id", [
    {
      firebase_uid: firebaseUid,
      media_type: item.mediaType,
      tmdb_id: item.tmdbId,
      title: item.title,
      poster_path: item.poster,
      liked_at: item.likedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
}

export async function removeLikeShadow(
  firebaseUid: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<void> {
  await removeEq(
    "likes",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&media_type=eq.${mediaType}&tmdb_id=eq.${tmdbId}`,
  );
}
