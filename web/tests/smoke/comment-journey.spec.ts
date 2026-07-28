import {expect, test} from "@playwright/test";
import {expectSignedInShell, hasSmokeCredentials, signIn, signOut} from "../helpers/auth";
import {maybeCreateComment} from "../helpers/comment-actions";
import {titleHadRecentComment} from "../helpers/account-state";
import {
  addToWatchlistOrAcceptExisting,
  captureDetail,
  markMovieWatchedOrVerifyExisting,
  openSearchResult,
  type SelectedMedia,
} from "../helpers/media-selection";
import {installAppCheckBypass, installNetworkMonitor} from "../helpers/network-monitor";

test.describe.configure({mode: "serial"});

test.describe("weekly natural comment journey", () => {
  test.skip(!hasSmokeCredentials(), "EPISODERA_TEST_EMAIL/EPISODERA_TEST_PASSWORD are not configured.");

  test("adds or verifies one natural spoiler-safe comment without duplicating recent account activity", async ({page}, testInfo) => {
    const monitor = installNetworkMonitor(page);
    await installAppCheckBypass(page);

    let selected: SelectedMedia | null = null;
    let result: Awaited<ReturnType<typeof maybeCreateComment>> | null = null;

    try {
      await test.step("Authentication", async () => {
        await signIn(page);
        monitor.noteSignedIn();
        await expectSignedInShell(page);
      });

      await test.step("Discover uncommented title and create comment", async () => {
        const candidates = ["Dune", "Inception", "The Matrix", "Arrival", "Interstellar", "Blade Runner"];
        for (const title of candidates) {
          const media = await openSearchResult(page, "movie", [title]);
          if (titleHadRecentComment(media)) {
            continue;
          }
          selected = media;
          await addToWatchlistOrAcceptExisting(page, selected, testInfo);
          await markMovieWatchedOrVerifyExisting(page, selected, testInfo);
          result = await maybeCreateComment(page, selected, testInfo, {force: true});
          if (result.status === "posted") {
            break;
          }
        }

        if (!selected || !result) {
          selected = await openSearchResult(page, "movie", [candidates[0]]);
          await addToWatchlistOrAcceptExisting(page, selected, testInfo);
          await markMovieWatchedOrVerifyExisting(page, selected, testInfo);
          result = await maybeCreateComment(page, selected, testInfo, {force: true});
        }
        await testInfo.attach("weekly-comment-result", {
          body: JSON.stringify(result, null, 2),
          contentType: "application/json",
        });
        if (result.status === "skipped") {
          throw new Error(`Weekly comment could not post or verify an existing comment: ${result.reason}`);
        }
        if (result.status === "verified-existing") {
          await testInfo.attach("weekly-comment-fallback", {
            body: "No safe new title was found; an existing account comment was verified instead.",
            contentType: "text/plain",
          });
        }
      });

      await test.step("Comment persistence", async () => {
        await page.reload({waitUntil: "domcontentloaded"});
        await captureDetail(page, "movie");
        if (result?.body) {
          await expect(page.locator('[data-testid^="discussion-"]').first()).toContainText(result.body);
        }
      });

      await test.step("Logout", async () => {
        await signOut(page);
      });

      await monitor.assertHealthy("weekly comment smoke");
    } finally {
      await monitor.attachDiagnostics(testInfo, "weekly-comment");
    }
  });
});
