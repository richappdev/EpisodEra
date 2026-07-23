import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HttpError} from "../lib/httpError";
import {parseSettingsInput} from "./settingsService";

const expectSettingsError = (body: unknown, code: string) => {
  assert.throws(
    () => parseSettingsInput(body),
    (error: unknown) => error instanceof HttpError && error.code === code,
  );
};

describe("parseSettingsInput", () => {
  it("normalizes every supported setting", () => {
    assert.deepEqual(
      parseSettingsInput({
        language: "zh-TW",
        autoMarkPreviousEpisodesWatched: true,
        preferredProviderIds: [8, "337", 8],
        watchRegion: "tw",
        achievementsEnabled: false,
        showAchievementsOnProfile: false,
        shareActivityWithFriends: true,
        allowFriendRequests: false,
        hideSpoilersUntilWatched: false,
      }),
      {
        language: "zh-TW",
        autoMarkPreviousEpisodesWatched: true,
        preferredProviderIds: [8, 337],
        watchRegion: "TW",
        achievementsEnabled: false,
        showAchievementsOnProfile: false,
        shareActivityWithFriends: true,
        allowFriendRequests: false,
        hideSpoilersUntilWatched: false,
      },
    );
  });

  it("limits provider ids to twelve unique values", () => {
    assert.deepEqual(
      parseSettingsInput({
        preferredProviderIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13],
      }),
      {preferredProviderIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]},
    );
  });

  it("rejects invalid payloads and unsupported values", () => {
    expectSettingsError(null, "invalid_settings_payload");
    expectSettingsError([], "invalid_settings_payload");
    expectSettingsError({}, "missing_settings");
    expectSettingsError({language: "fr-FR"}, "unsupported_language");
    expectSettingsError(
      {autoMarkPreviousEpisodesWatched: "yes"},
      "invalid_autoMarkPreviousEpisodesWatched",
    );
    expectSettingsError({preferredProviderIds: "8"}, "invalid_providers");
    expectSettingsError({preferredProviderIds: [8, 0]}, "invalid_providers");
    expectSettingsError({watchRegion: "USA"}, "invalid_watch_region");
    expectSettingsError({achievementsEnabled: 1}, "invalid_achievementsEnabled");
    expectSettingsError(
      {showAchievementsOnProfile: null},
      "invalid_showAchievementsOnProfile",
    );
    expectSettingsError(
      {shareActivityWithFriends: "false"},
      "invalid_shareActivityWithFriends",
    );
    expectSettingsError({allowFriendRequests: 0}, "invalid_allowFriendRequests");
    expectSettingsError(
      {hideSpoilersUntilWatched: undefined},
      "invalid_hideSpoilersUntilWatched",
    );
  });
});
