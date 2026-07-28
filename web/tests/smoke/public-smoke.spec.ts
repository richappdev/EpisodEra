import {expect, test} from "@playwright/test";
import {captureDetail, openFirstCard, waitForAppShell, waitForCards} from "../helpers/media-selection";
import {installAppCheckBypass, installNetworkMonitor} from "../helpers/network-monitor";

test("public visitor can browse and open a content detail page", async ({page}, testInfo) => {
  const monitor = installNetworkMonitor(page);
  await installAppCheckBypass(page);

  try {
    await test.step("Site availability", async () => {
      const response = await page.goto("/home", {waitUntil: "domcontentloaded"});
      expect(response?.ok(), `Document response status: ${response?.status()}`).toBeTruthy();
      await waitForAppShell(page);
      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.locator(".state-panel.error")).toHaveCount(0);
    });

    await test.step("Content discovery", async () => {
      await waitForCards(page);
      await expect(page.locator('[data-testid^="media-card-"]').first()).toContainText(/TV|Movie/);
      await expect(page.getByTestId("nav-search")).toBeVisible();
      await expect(page.getByTestId("nav-watchlist")).toBeVisible();
    });

    await test.step("Content detail", async () => {
      const media = await openFirstCard(page);
      await expect(page).toHaveURL(/\/(tv|movie)\/\d+/);
      await expect(page.getByRole("heading", {name: media.title})).toBeVisible();
      await expect(page.getByText(/Sign in to save this title/i)).toBeVisible();
      await expect(page.locator(".state-panel.error")).toHaveCount(0);
      await captureDetail(page, media.mediaType);
    });

    await monitor.assertHealthy("public smoke");
  } finally {
    await monitor.attachDiagnostics(testInfo, "public-smoke");
  }
});
