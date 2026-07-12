import {expect, test} from "@playwright/test";
import {installMockApi, showId} from "./support/mockApi";

const criticalNavLabels = ["Trending", "Search", "Watchlist", "Profile", "Settings"];

test("signed-in shell keeps critical controls accessible on desktop and mobile", async ({page}) => {
  await installMockApi(page, {
    initialWatchedEpisodes: [1],
    initialWatchlistStatus: "watching",
  });

  for (const viewport of [
    {width: 1280, height: 900},
    {width: 390, height: 844},
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible();
    if (viewport.width >= 768) {
      await expect(page.getByText("e2e-user@example.com")).toBeVisible();
    }

    for (const label of criticalNavLabels) {
      await expect(page.getByRole("button", {name: label})).toBeVisible();
    }

    await expect(page.getByTestId("account-button")).toHaveAccessibleName("Sign out");
    await expect(page.getByRole("contentinfo")).toContainText("This product uses the TMDb API");

    await page.getByTestId("nav-watchlist").click();
    await expect(page.getByTestId("watchlist-header")).toBeVisible();
    await expect(page.getByTestId(`continue-watched-${showId}`)).toHaveAccessibleName("Watched");
    await expect(page.getByLabel("Watchlist status for Critical Flow Show")).toBeVisible();
  }
});
