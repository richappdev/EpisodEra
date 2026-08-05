import {expect, test} from "@playwright/test";
import {installMockApi} from "./support/mockApi";

test("explicit URL language wins and Settings persists while preserving query and hash", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("episodera.language", "zh-TW"));
  const requests = await installMockApi(page);

  const settingsLoaded = page.waitForResponse((response) => response.url().includes("/e2e-api/me/settings") && response.request().method() === "GET");
  await page.goto("/en-us/settings?source=shared#language");
  await settingsLoaded;
  await expect(page).toHaveURL(/\/en-us\/settings\?source=shared#language$/);
  const language = page.getByLabel("App language");
  await expect(language).toHaveValue("en-US");

  await language.selectOption("zh-TW");
  await expect(page).toHaveURL(/\/zh-tw\/settings\?source=shared#language$/);
  await expect(page.getByRole("heading", {name: "設定"})).toBeVisible();
  await expect.poll(() => requests.state.settingsLanguage).toBe("zh-TW");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("episodera.language"))).toBe("zh-TW");
});

test("legacy paths resolve to the loaded account preference", async ({page}) => {
  const requests = await installMockApi(page);
  requests.state.settingsLanguage = "zh-TW";
  await page.goto("/settings?legacy=1#language");
  await expect(page).toHaveURL(/\/zh-tw\/settings\?legacy=1#language$/);
});
