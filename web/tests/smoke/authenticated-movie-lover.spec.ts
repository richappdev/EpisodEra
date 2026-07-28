import {expect, test} from "@playwright/test";
import {expectSignedInShell, hasSmokeCredentials, signIn, signOut} from "../helpers/auth";
import {maybeCreateComment} from "../helpers/comment-actions";
import {
  addToWatchlistOrAcceptExisting,
  captureDetail,
  markEpisodeWatchedOrVerifyExisting,
  markMovieWatchedOrVerifyExisting,
  openSearchResult,
  verifyProgressVisible,
  verifyWatchlistContains,
  type SelectedMedia,
} from "../helpers/media-selection";
import {installAppCheckBypass, installNetworkMonitor} from "../helpers/network-monitor";

test.describe.configure({mode: "serial"});

test.describe("authenticated persistent movie-lover journey", () => {
  test.skip(!hasSmokeCredentials(), "EPISODERA_TEST_EMAIL/EPISODERA_TEST_PASSWORD are not configured.");

  test("tracks shows, saves movies, comments occasionally, persists state, and signs out", async ({browser}, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string | undefined,
      viewport: {width: 1366, height: 850},
    });
    const page = await context.newPage();
    const monitor = installNetworkMonitor(page);
    await installAppCheckBypass(page);

    let selectedShow: SelectedMedia;
    let selectedMovie: SelectedMedia;
    let submittedComment: string | undefined;

    try {
      await test.step("Authentication", async () => {
        await signIn(page);
        monitor.noteSignedIn();
        await expectSignedInShell(page);
      });

      await test.step("TV detail", async () => {
        selectedShow = await openSearchResult(page, "tv", ["Silo", "The Bear", "Severance", "Arcane"]);
        await addToWatchlistOrAcceptExisting(page, selectedShow, testInfo);
        const status = page.getByTestId("detail-status-watching");
        if (await status.isVisible().catch(() => false)) {
          await status.click();
          await expect(status).toHaveAttribute("aria-pressed", "true", {timeout: 30_000});
        }
      });

      await test.step("Episode tracking", async () => {
        const result = await markEpisodeWatchedOrVerifyExisting(page, testInfo);
        await expect(page.getByTestId("show-progress-summary").or(page.getByText(/watched/i).first()).first()).toBeVisible();
        return result;
      });

      await test.step("Continue Watching verification", async () => {
        const location = await verifyProgressVisible(page, selectedShow!);
        await testInfo.attach("progress-location", {body: location, contentType: "text/plain"});
      });

      await test.step("Watchlist verification", async () => {
        const location = await verifyWatchlistContains(page, selectedShow!);
        await testInfo.attach("show-watchlist-location", {body: location, contentType: "text/plain"});
      });

      await test.step("Movie watchlist", async () => {
        selectedMovie = await openSearchResult(page, "movie", ["Dune", "Inception", "The Matrix", "Interstellar"]);
        await addToWatchlistOrAcceptExisting(page, selectedMovie, testInfo);
        await markMovieWatchedOrVerifyExisting(page, selectedMovie, testInfo);
        const location = await verifyWatchlistContains(page, selectedMovie);
        await testInfo.attach("movie-watchlist-location", {body: location, contentType: "text/plain"});
      });

      await test.step("Comment creation", async () => {
        await page.goto(selectedMovie!.detailUrl, {waitUntil: "domcontentloaded"});
        await captureDetail(page, "movie");
        const result = await maybeCreateComment(page, selectedMovie!, testInfo);
        submittedComment = result.body;
        await testInfo.attach("comment-result", {body: JSON.stringify(result, null, 2), contentType: "application/json"});
      });

      await test.step("Persistence verification", async () => {
        await page.reload({waitUntil: "domcontentloaded"});
        await expectSignedInShell(page);
        await verifyWatchlistContains(page, selectedShow!);
        await verifyWatchlistContains(page, selectedMovie!);
        await page.goto(selectedShow!.detailUrl, {waitUntil: "domcontentloaded"});
        await captureDetail(page, "tv");
        await expect(page.getByTestId("show-progress-summary").or(page.getByText(/watched/i).first()).first()).toBeVisible({
          timeout: 45_000,
        });
        if (submittedComment) {
          await page.goto(selectedMovie!.detailUrl, {waitUntil: "domcontentloaded"});
          await captureDetail(page, "movie");
          await expect(page.locator('[data-testid^="discussion-"]').first()).toContainText(submittedComment, {
            timeout: 30_000,
          });
        }
      });

      await test.step("New context persistence", async () => {
        const secondContext = await browser.newContext({
          baseURL: testInfo.project.use.baseURL as string | undefined,
          viewport: {width: 1366, height: 850},
        });
        const secondPage = await secondContext.newPage();
        const secondMonitor = installNetworkMonitor(secondPage);
        await installAppCheckBypass(secondPage);
        try {
          await signIn(secondPage);
          secondMonitor.noteSignedIn();
          await verifyWatchlistContains(secondPage, selectedShow!);
          await verifyWatchlistContains(secondPage, selectedMovie!);
          await secondMonitor.assertHealthy("authenticated second-context persistence");
        } finally {
          await secondMonitor.attachDiagnostics(testInfo, "authenticated-second-context");
          await secondContext.close();
        }
      });

      await test.step("Logout", async () => {
        await signOut(page);
      });

      await monitor.assertHealthy("authenticated movie-lover smoke");
    } finally {
      await monitor.attachDiagnostics(testInfo, "authenticated-movie-lover");
      await context.close();
    }
  });
});
