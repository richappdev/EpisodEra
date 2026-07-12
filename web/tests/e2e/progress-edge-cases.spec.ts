import {expect, test} from "@playwright/test";
import {installMockApi, openShowDetailFromSearch, showId} from "./support/mockApi";

test("continue watching resolves the first unwatched gap and sends a canonical episode write", async ({page}) => {
  const requests = await installMockApi(page, {
    initialWatchedEpisodes: [1, 3],
    initialWatchlistStatus: "watching",
  });

  await page.goto("/");
  await page.getByTestId("nav-watchlist").click();

  await expect(page.getByTestId(`continue-card-${showId}`)).toContainText("2 of 3 watched");
  await expect(page.getByTestId(`continue-next-${showId}`)).toHaveText("Next up S1 E2");

  await page.getByTestId(`continue-watched-${showId}`).click();

  await expect(page.getByTestId(`continue-card-${showId}`)).toHaveCount(0);
  expect(requests.progressBatchBodies.at(-1)).toEqual({
    watched: true,
    episodes: [{seasonNumber: 1, episodeNumber: 2}],
  });
});

test("mark season watched batches all available unwatched episodes", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/");
  await openShowDetailFromSearch(page);

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTestId("mark-season-watched").click();

  await expect(page.getByText("3 of 3 watched")).toBeVisible();
  expect(requests.progressBatchBodies.at(-1)).toEqual({
    watched: true,
    episodes: [
      {seasonNumber: 1, episodeNumber: 1},
      {seasonNumber: 1, episodeNumber: 2},
      {seasonNumber: 1, episodeNumber: 3},
    ],
  });
});

test("failed episode progress write preserves current watched state and surfaces the API error", async ({page}) => {
  const requests = await installMockApi(page, {initialWatchedEpisodes: [1]});

  await page.goto("/");
  await openShowDetailFromSearch(page);

  await expect(page.getByText("1 of 3 watched")).toBeVisible();
  requests.failNextProgressWrite();
  await page.getByTestId("episode-toggle-s01e02").click();

  await expect(page.getByText("Temporary progress outage.")).toBeVisible();
  await expect(page.getByText("1 of 3 watched")).toBeVisible();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  await expect(page.getByTestId("episode-toggle-s01e02")).toContainText("Mark watched");
  expect(requests.progressBatchBodies.at(-1)).toEqual({
    watched: true,
    episodes: [{seasonNumber: 1, episodeNumber: 2}],
  });
});
