import test from "node:test";
import assert from "node:assert/strict";

import {dualWrite, SyncFailureWriter} from "./dualWrite";

test("dualWrite returns primary and records secondary failure", async () => {
  const recorded: unknown[] = [];
  const failures: SyncFailureWriter = {
    async record(failure) {
      recorded.push(failure);
    },
  };

  const result = await dualWrite({
    operationId: "op-1",
    firebaseUid: "uid-1",
    domain: "watchlist",
    operation: "add",
    payload: {tmdbId: 1},
    primary: async () => ({ok: true}),
    secondary: async () => {
      throw new Error("supabase down");
    },
    failures,
  });

  assert.deepEqual(result.primary, {ok: true});
  assert.equal(result.secondaryError, "supabase down");
  assert.equal(recorded.length, 1);
});

test("dualWrite succeeds when secondary succeeds", async () => {
  const failures: SyncFailureWriter = {
    async record() {
      throw new Error("should not record");
    },
  };

  const result = await dualWrite({
    operationId: "op-2",
    domain: "watchlist",
    operation: "add",
    payload: {},
    primary: async () => 42,
    secondary: async () => undefined,
    failures,
  });

  assert.equal(result.primary, 42);
  assert.equal(result.secondaryError, null);
});
