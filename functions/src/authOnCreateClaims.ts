import {getAuth} from "firebase-admin/auth";
import {auth} from "firebase-functions/v1";

/**
 * Fallback (no Identity Platform required): set Supabase third-party Auth role claim
 * on every new Firebase user. Existing users: scripts/supabase/backfill-firebase-role-claim.mjs
 *
 * Note: onCreate is async — clients should getIdToken(true) once after first signup
 * if the first token lacks role=authenticated.
 */
export const onUserCreatedSetSupabaseRole = auth.user().onCreate(async (user) => {
  const authAdmin = getAuth();
  const existing = (await authAdmin.getUser(user.uid)).customClaims ?? {};
  if (existing.role === "authenticated") {
    return;
  }
  await authAdmin.setCustomUserClaims(user.uid, {
    ...existing,
    role: "authenticated",
  });
});
