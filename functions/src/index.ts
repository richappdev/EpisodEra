import {initializeApp} from "firebase-admin/app";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {app} from "./api/app";
import {puzzleService} from "./services/puzzleService";

initializeApp();

export const api = onRequest(
  {
    region: "us-central1",
    secrets: ["TMDB_API_KEY"],
    timeoutSeconds: 60,
  },
  app,
);

/** Publishes scheduled daily puzzles at UTC midnight. */
export const publishScheduledPuzzle = onSchedule(
  {
    schedule: "1 0 * * *",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    await puzzleService.publishScheduledPuzzles();
  },
);

// Blocking Auth claim helpers for Supabase third-party Auth live in ./authClaims.ts.
// Export them from this file only after Identity Platform is enabled on project episodera:
//   export {beforecreated, beforesignedin} from "./authClaims";

