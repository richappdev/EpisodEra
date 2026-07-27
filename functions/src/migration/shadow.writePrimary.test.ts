import test, {afterEach} from "node:test";
import assert from "node:assert/strict";

import {writeSupabasePrimaryOrShadow, shadowWrite} from "./shadow";

const previousFetch = globalThis.fetch;
const envKeys = [
  "SUPABASE_SHADOW_WRITES",
  "SUPABASE_WRITE_PRIMARY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const clearEnv = () => {
  for (const key of envKeys) {
    delete process.env[key];
  }
};

afterEach(() => {
  globalThis.fetch = previousFetch;
  clearEnv();
});

test("shadowWrite is a no-op without shadow flag or supabase env", async () => {
  let called = 0;
  await shadowWrite({
    domain: "watchlist",
    operation: "upsert",
    firebaseUid: "u1",
    operationId: "op-1",
    payload: {},
    secondary: async () => {
      called += 1;
    },
  });
  assert.equal(called, 0);
});

test("writeSupabasePrimaryOrShadow writes immediately when write-primary is on", async () => {
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);
  let called = 0;
  await writeSupabasePrimaryOrShadow({
    domain: "watchlist",
    operation: "upsert",
    firebaseUid: "u1",
    operationId: "op-2",
    payload: {ok: true},
    write: async () => {
      called += 1;
    },
  });
  assert.equal(called, 1);
});

test("writeSupabasePrimaryOrShadow requires supabase env in write-primary mode", async () => {
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  await assert.rejects(
    () =>
      writeSupabasePrimaryOrShadow({
        domain: "watchlist",
        operation: "upsert",
        firebaseUid: "u1",
        operationId: "op-3",
        payload: {},
        write: async () => undefined,
      }),
    /SUPABASE_WRITE_PRIMARY requires/,
  );
});

test("writeSupabasePrimaryOrShadow falls back to shadow when write-primary is off", async () => {
  process.env.SUPABASE_SHADOW_WRITES = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);
  let called = 0;
  globalThis.fetch = (async () => new Response("[]", {status: 200})) as typeof fetch;

  await writeSupabasePrimaryOrShadow({
    domain: "watchlist",
    operation: "upsert",
    firebaseUid: "u1",
    operationId: "op-4",
    payload: {},
    write: async () => {
      called += 1;
    },
  });
  assert.equal(called, 1);
});
