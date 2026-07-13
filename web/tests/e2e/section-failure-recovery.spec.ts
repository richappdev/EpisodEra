import {expect, test} from "@playwright/test";
import {installMockApi, showId} from "./support/mockApi";

test("watchlist failure does not block profile stats and recovers on retry", async ({page}) => {
  await installMockApi(page, {
    failOnceEndpoints: ["watchlist"],
    initialWatchlistStatus: "watching",
    initialWatchedEpisodes: [1],
  });

  await page.goto("/");
  await expect(page.getByText("Welcome, E2E")).toBeVisible();

  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByRole("alert")).toContainText("Temporary watchlist outage.");

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("1");
  await expect(page.getByTestId("stat-currently-watching")).toHaveText("1");
  await expect(page.getByTestId("history-row-tv_1001_s01e01")).toBeVisible();

  await page.getByTestId("nav-watchlist").click();
  await page.getByRole("button", {name: "Retry"}).click();
  await expect(page.getByTestId(`watchlist-item-${showId}`)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("history failure preserves profile stats and recovers on retry", async ({page}) => {
  await installMockApi(page, {
    failOnceEndpoints: ["history"],
    initialWatchlistStatus: "watching",
    initialWatchedEpisodes: [1],
  });

  await page.goto("/profile");
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("1");
  await expect(page.getByTestId("stat-watchlist-count")).toHaveText("1");
  await expect(page.getByRole("alert")).toContainText("Temporary history outage.");
  await expect(page.getByTestId("history-row-tv_1001_s01e01")).toHaveCount(0);

  await page.getByRole("button", {name: "Retry"}).click();
  await expect(page.getByTestId("history-row-tv_1001_s01e01")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
