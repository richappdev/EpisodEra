import test from "node:test";
import assert from "node:assert/strict";

import {assertServerOnlySupabaseConfig, readSupabaseEnv} from "./supabaseEnv";

test("readSupabaseEnv returns null when unset", () => {
  assert.equal(readSupabaseEnv({}), null);
});

test("readSupabaseEnv reads url and service role", () => {
  const env = readSupabaseEnv({
    SUPABASE_URL: "https://xyhhnoxvydshqpypwccr.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40),
  });
  assert.ok(env);
  assertServerOnlySupabaseConfig(env!);
});
