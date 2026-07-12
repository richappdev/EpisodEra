import {expect, test} from "@playwright/test";
import {installMockApi, openShowDetailFromSearch, showId} from "./support/mockApi";

test("signed-in user can complete the core watchlist and episode progress flow", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/");
  await expect(page.getByText("e2e-user@example.com")).toBeVisible();

  await openShowDetailFromSearch(page);

  await expect(page.getByTestId(`detail-tv-${showId}`)).toBeVisible();
  await expect(page.getByRole("heading", {name: "Critical Flow Show"})).toBeVisible();

  await page.getByTestId("detail-add-watchlist").click();
  await expect(page.getByText("In watchlist")).toBeVisible();

  await page.getByTestId("detail-watchlist-status").selectOption("watching");
  await expect(page.getByTestId("detail-watchlist-status")).toHaveValue("watching");

  await page.getByTestId("episode-toggle-s01e01").click();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  await expect(page.getByText("1 of 3 watched")).toBeVisible();

  expect(requests.progressBatchBodies).toEqual([
    {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]},
  ]);
  expect(Object.keys(requests.progressBatchBodies[0].episodes[0]).sort()).toEqual(["episodeNumber", "seasonNumber"]);

  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByTestId(`watchlist-item-${showId}`)).toContainText("Critical Flow Show");
  await expect(page.getByTestId(`continue-card-${showId}`)).toContainText("1 of 3 watched");
  await expect(page.getByTestId(`continue-next-${showId}`)).toHaveText("Next up S1 E2");

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("1");
  await expect(page.getByTestId("stat-currently-watching")).toHaveText("1");
  await expect(page.getByTestId("stat-watchlist-count")).toHaveText("1");
  await expect(page.getByTestId("history-row-tv_1001_s01e01")).toContainText("Pilot");

  await page.getByTestId("nav-watchlist").click();
  await page.getByTestId(`watchlist-item-${showId}`).getByRole("button", {name: "Critical Flow Show", exact: true}).click();
  await page.getByTestId("episode-toggle-s01e01").click();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Mark watched");
  await expect(page.getByText("No watched episodes yet.")).toBeVisible();

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("0");
  await expect(page.getByText("Watched movies and episodes will appear here.")).toBeVisible();

  await page.getByTestId("account-button").click();
  await expect(page.getByTestId("account-button")).toContainText("Sign in");
  await expect(page.getByText("e2e-user@example.com")).toHaveCount(0);
  await expect(page.getByRole("heading", {name: "Trending TV Shows"})).toBeVisible();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveCount(0);
});
