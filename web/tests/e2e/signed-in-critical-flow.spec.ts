import {expect, test} from "@playwright/test";
import {installMockApi, openShowDetailFromSearch, showId} from "./support/mockApi";

test("signed-in user can complete the core watchlist and episode progress flow", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/home");
  await expect(page.getByText("Welcome, E2E")).toBeVisible();

  await openShowDetailFromSearch(page);

  await expect(page.getByTestId(`detail-tv-${showId}`)).toBeVisible();
  await expect(page.getByRole("heading", {name: "Critical Flow Show"})).toBeVisible();

  await page.getByTestId("detail-add-watchlist").click();
  await expect(page.getByTestId("detail-remove-watchlist")).toBeVisible();
  await expect(page.getByTestId("detail-add-watchlist")).toHaveCount(0);

  await page.getByTestId("detail-watchlist-status").selectOption("watching");
  await expect(page.getByTestId("detail-watchlist-status")).toHaveValue("watching");

  await page.getByTestId("episode-toggle-s01e01").click();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  await expect(page.getByText("1 of 3 watched · 2 remaining")).toBeVisible();

  expect(requests.progressBatchBodies).toEqual([
    {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]},
  ]);
  expect(Object.keys(requests.progressBatchBodies[0].episodes[0]).sort()).toEqual(["episodeNumber", "seasonNumber"]);

  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByTestId(`watchlist-item-${showId}`)).toContainText("Critical Flow Show");
  await expect(page.getByTestId(`continue-card-${showId}`)).toBeVisible();
  await expect(page.getByTestId(`continue-next-${showId}`)).toHaveText("S1 · E2 — The Gap");
  await expect(page.getByTestId(`continue-watched-${showId}`)).toHaveAccessibleName("Mark watched");

  await page.getByTestId("nav-trending").click();
  await expect(page.getByTestId(`continue-card-${showId}`)).toBeVisible();
  await expect(page.getByTestId(`continue-watched-${showId}`)).toBeVisible();
  await expect(page.getByTestId("continue-see-all")).toBeVisible();

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
  await expect(page.getByText("Welcome, E2E")).toHaveCount(0);
  await expect(page.getByTestId("account-button")).toHaveCount(0);
  await expect(page.getByTestId("nav-trending")).toHaveCount(0);
  await expect(page.locator(".landing-brand-mark")).toBeVisible();
  await expect(page.getByRole("heading", {name: "Your watching memory, in one place."})).toBeVisible();
  await expect(page.getByRole("link", {name: "Sign in"})).toBeVisible();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveCount(0);
});
