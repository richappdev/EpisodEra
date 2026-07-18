import {expect, test} from "@playwright/test";
import {createMockApiState, installMockApi, openShowDetailFromSearch, showId} from "./support/mockApi";

test("continue watching resolves the first unwatched gap and sends a canonical episode write", async ({page}) => {
  const requests = await installMockApi(page, {
    initialWatchedEpisodes: [1, 3],
    initialWatchlistStatus: "watching",
  });

  await page.goto("/home");

  await expect(page.getByTestId(`continue-card-${showId}`)).toBeVisible();
  await expect(page.getByTestId(`continue-next-${showId}`)).toHaveText("S1 E2");

  await page.getByTestId(`continue-watched-${showId}`).click();

  await expect(page.getByTestId(`continue-card-${showId}`)).toHaveCount(0);
  expect(requests.progressBatchBodies.at(-1)).toEqual({
    watched: true,
    episodes: [{seasonNumber: 1, episodeNumber: 2}],
  });
});

test("mark season watched batches all available unwatched episodes", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/home");
  await openShowDetailFromSearch(page);

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTestId("mark-season-watched").click();

  await expect(page.getByText(/3 of 3 watched \(100%\)/)).toBeVisible();
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

  await page.goto("/home");
  await openShowDetailFromSearch(page);

  await expect(page.getByText("1 of 3 watched · 2 remaining")).toBeVisible();
  requests.failNextProgressWrite();
  await page.getByTestId("episode-toggle-s01e02").click();

  await expect(page.getByText("Temporary progress outage.")).toBeVisible();
  await expect(page.getByText("1 of 3 watched · 2 remaining")).toBeVisible();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  await expect(page.getByTestId("episode-toggle-s01e02")).toContainText("Mark watched");
  expect(requests.progressBatchBodies.at(-1)).toEqual({
    watched: true,
    episodes: [{seasonNumber: 1, episodeNumber: 2}],
  });
});

test("offline progress write can be retried without corrupting watched state", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/home");
  await openShowDetailFromSearch(page);

  requests.abortNextProgressWrite();
  await page.getByTestId("episode-toggle-s01e01").click();

  await expect(page.getByText(/Failed to fetch|Could not update episode progress/)).toBeVisible();
  await expect(page.getByText("No watched episodes yet.")).toBeVisible();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Mark watched");

  await page.getByTestId("episode-toggle-s01e01").click();

  await expect(page.getByText("1 of 3 watched · 2 remaining")).toBeVisible();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  expect(requests.progressBatchBodies).toEqual([
    {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]},
    {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]},
  ]);
});

test("pending progress write disables duplicate episode actions", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/home");
  await openShowDetailFromSearch(page);

  requests.holdNextProgressWrite();
  const firstClick = page.getByTestId("episode-toggle-s01e01").click();

  await expect.poll(() => requests.progressBatchBodies.length).toBe(1);
  await expect(page.getByTestId("episode-toggle-s01e01")).toBeDisabled();
  await expect(page.getByTestId("episode-toggle-s01e02")).toBeDisabled();

  requests.releaseProgressWrite();
  await firstClick;

  await expect(page.getByText("1 of 3 watched · 2 remaining")).toBeVisible();
  expect(requests.progressBatchBodies).toEqual([{watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]}]);
});

test("concurrent browser progress writes converge to a consistent final summary", async ({browser, baseURL}) => {
  const state = createMockApiState({
    initialWatchedEpisodes: [1],
    initialWatchlistStatus: "watching",
  });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const requestsA = await installMockApi(pageA, {state});
  await installMockApi(pageB, {state});

  await Promise.all([pageA.goto(baseURL ? `${baseURL.replace(/\/$/, "")}/home` : "/home"), pageB.goto(baseURL ? `${baseURL.replace(/\/$/, "")}/home` : "/home")]);
  await Promise.all([openShowDetailFromSearch(pageA), openShowDetailFromSearch(pageB)]);

  await Promise.all([
    pageA.getByTestId("episode-toggle-s01e02").click(),
    pageB.getByTestId("episode-toggle-s01e03").click(),
  ]);

  await pageA.reload();
  await pageA.getByTestId("nav-profile").click();
  await expect(pageA.getByTestId("stat-watched-episodes")).toHaveText("3");
  await expect(pageA.getByTestId("history-row-tv_1001_s01e01")).toContainText("Pilot");
  await expect(pageA.getByTestId("history-row-tv_1001_s01e02")).toContainText("The Gap");
  await expect(pageA.getByTestId("history-row-tv_1001_s01e03")).toContainText("Next Step");

  await pageA.getByTestId("nav-trending").click();
  await expect(pageA.getByTestId(`continue-card-${showId}`)).toHaveCount(0);
  expect(requestsA.progressBatchBodies).toHaveLength(2);
  expect(requestsA.progressBatchBodies).toEqual(
    expect.arrayContaining([
      {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 2}]},
      {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 3}]},
    ]),
  );

  await contextA.close();
  await contextB.close();
});
