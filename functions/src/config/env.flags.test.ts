import test from "node:test";
import assert from "node:assert/strict";

import {
  isSupabaseReadDiscussions,
  isSupabaseReadFranchises,
  isSupabaseReadImportStaging,
  isSupabaseReadMediaMappings,
  isSupabaseReadPuzzles,
  isSupabaseWritePrimary,
  shouldPersistFirestore,
} from "../config/env";

const KEYS = [
  "SUPABASE_READ_DISCUSSIONS",
  "SUPABASE_READ_PUZZLES",
  "SUPABASE_READ_FRANCHISES",
  "SUPABASE_READ_MEDIA_MAPPINGS",
  "SUPABASE_READ_IMPORT_STAGING",
  "SUPABASE_READ_PRIMARY",
  "SUPABASE_WRITE_PRIMARY",
  "FIRESTORE_WRITES_DISABLED",
] as const;

const snapshotEnv = () => {
  const previous: Record<string, string | undefined> = {};
  for (const key of KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  return previous;
};

const restoreEnv = (previous: Record<string, string | undefined>) => {
  for (const key of KEYS) {
    if (previous[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous[key];
    }
  }
};

test("remaining-domain read flags honor domain and primary switches", () => {
  const previous = snapshotEnv();
  try {
    assert.equal(isSupabaseReadDiscussions(), false);
    process.env.SUPABASE_READ_DISCUSSIONS = "true";
    assert.equal(isSupabaseReadDiscussions(), true);

    delete process.env.SUPABASE_READ_DISCUSSIONS;
    process.env.SUPABASE_READ_PRIMARY = "1";
    assert.equal(isSupabaseReadPuzzles(), true);
    assert.equal(isSupabaseReadFranchises(), true);
    assert.equal(isSupabaseReadMediaMappings(), true);
    assert.equal(isSupabaseReadImportStaging(), true);
  } finally {
    restoreEnv(previous);
  }
});

test("write-primary and firestore persistence flags", () => {
  const previous = snapshotEnv();
  try {
    assert.equal(isSupabaseWritePrimary(), false);
    assert.equal(shouldPersistFirestore(), true);

    process.env.SUPABASE_WRITE_PRIMARY = "yes";
    assert.equal(isSupabaseWritePrimary(), true);

    process.env.FIRESTORE_WRITES_DISABLED = "on";
    assert.equal(shouldPersistFirestore(), false);
  } finally {
    restoreEnv(previous);
  }
});
