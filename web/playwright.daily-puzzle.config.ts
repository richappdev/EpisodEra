/**
 * Local smoke: open daily puzzle, play sample mode through a wrong then correct guess.
 * Usage (from web/): npx playwright test --config=playwright.daily-puzzle.config.ts
 */
import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/daily-puzzle.local.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Desktop Chrome"],
  },
  webServer: undefined,
});
