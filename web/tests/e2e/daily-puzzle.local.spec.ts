import {expect, test} from "@playwright/test";

test.describe("daily puzzle local sample mode", () => {
  test("loads and completes a sample puzzle", async ({page}) => {
    await page.goto("/play/daily-puzzle");
    await expect(page.getByRole("heading", {name: /which show is this/i})).toBeVisible({timeout: 30_000});

    const sampleBanner = page.getByText(/playing sample puzzle/i);
    const ozark = page.getByRole("button", {name: /^Ozark$/i});
    await expect(ozark).toBeVisible({timeout: 15_000});

    await ozark.click();
    await expect(page.locator(".daily-puzzle-hint")).toContainText(/Not this one/i, {timeout: 10_000});

    const breakingBad = page.getByRole("button", {name: /^Breaking Bad$/i});
    await expect(breakingBad).toBeEnabled();
    await breakingBad.click();

    await expect(page.locator(".daily-puzzle-result")).toContainText(/Correct in/i, {timeout: 10_000});
    await expect(page.getByRole("button", {name: /view show/i})).toBeVisible();
    await expect(page.getByRole("button", {name: /share result/i})).toBeVisible();

    if (await sampleBanner.isVisible().catch(() => false)) {
      expect(await sampleBanner.textContent()).toMatch(/sample/i);
    }
  });
});
