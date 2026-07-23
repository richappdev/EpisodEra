import test from "node:test";
import assert from "node:assert/strict";
import {dualWrite} from "../repositories/dualWrite";

test("shadow dualWrite records outbox-style failures without throwing primary", async () => {
  const recorded: string[] = [];
  const result = await dualWrite({
    operationId: "watchlist:upsert:u1:movie_1",
    firebaseUid: "u1",
    domain: "watchlist",
    operation: "upsert",
    payload: {tmdbId: 1},
    primary: async () => "ok",
    secondary: async () => {
      throw new Error("supabase unavailable");
    },
    failures: {
      async record(failure) {
        recorded.push(failure.error);
      },
    },
  });
  assert.equal(result.primary, "ok");
  assert.equal(result.secondaryError, "supabase unavailable");
  assert.deepEqual(recorded, ["supabase unavailable"]);
});
