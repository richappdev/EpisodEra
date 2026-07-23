import {
  beforeUserCreated,
  beforeUserSignedIn,
} from "firebase-functions/v2/identity";

/**
 * Assign Supabase-compatible role claim for Firebase third-party Auth.
 * Requires Identity Platform (blocking functions). If unavailable, use
 * scripts/supabase/backfill-firebase-role-claim.mjs + auth.user().onCreate instead.
 */
export const beforecreated = beforeUserCreated(() => ({
  customClaims: {
    role: "authenticated",
  },
}));

export const beforesignedin = beforeUserSignedIn(() => ({
  customClaims: {
    role: "authenticated",
  },
}));
