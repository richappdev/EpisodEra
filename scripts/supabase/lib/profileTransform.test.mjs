import test from "node:test";
import assert from "node:assert/strict";
import {mapProfileRow, mapSettingsRow, normalizeFriendCode} from "./profileTransform.mjs";

test("mapProfileRow fills required fields and normalizes country/friend code", () => {
  const row = mapProfileRow(
    "uid-1",
    {
      firstName: " Ada ",
      lastName: " Lovelace ",
      email: " ada@example.com ",
      country: "tw",
      friendCode: "ab12cd",
      photoURL: " https://example.com/a.png ",
    },
    null,
  );
  assert.equal(row.firebase_uid, "uid-1");
  assert.equal(row.first_name, "Ada");
  assert.equal(row.last_name, "Lovelace");
  assert.equal(row.email, "ada@example.com");
  assert.equal(row.country, "TW");
  assert.equal(row.friend_code, "AB12CD");
  assert.equal(row.photo_url, "https://example.com/a.png");
});

test("mapProfileRow falls back to auth email and placeholders", () => {
  const row = mapProfileRow("uid-2", {}, "fallback@example.com");
  assert.equal(row.first_name, "User");
  assert.equal(row.last_name, "Unknown");
  assert.equal(row.email, "fallback@example.com");
  assert.equal(normalizeFriendCode("bad"), null);
});

test("mapSettingsRow preserves firestore fields in raw and maps locale/spoilers", () => {
  const row = mapSettingsRow("uid-3", {
    language: "zh-TW",
    hideSpoilersUntilWatched: true,
    preferredProviderIds: [8, 9],
  });
  assert.equal(row.locale, "zh-TW");
  assert.equal(row.spoiler_mode, "until_watched");
  assert.deepEqual(row.raw.preferredProviderIds, [8, 9]);
});
