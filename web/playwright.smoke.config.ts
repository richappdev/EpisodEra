import fs from "node:fs";
import path from "node:path";
import {defineConfig, devices} from "@playwright/test";

const normalizeEnv = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadEnvFile = (filePath: string) => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    return;
  }

  for (const line of fs.readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = normalizeEnv(trimmed.slice(index + 1));
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.smoke");

const smokeGrep = process.env.EPISODERA_SMOKE_GREP;

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 6 * 60 * 1000,
  expect: {
    timeout: 30_000,
  },
  grep: smokeGrep ? new RegExp(smokeGrep) : undefined,
  reporter: [
    ["list"],
    ["html", {open: "never", outputFolder: "playwright-report/smoke"}],
    ["json", {outputFile: "test-results/smoke-results.json"}],
    ["junit", {outputFile: "test-results/smoke-junit.xml"}],
  ],
  outputDir: "test-results/smoke-artifacts",
  use: {
    baseURL: process.env.EPISODERA_HOSTING_URL ?? "https://episodera.web.app",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    viewport: {width: 1366, height: 850},
  },
  projects: [
    {
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
  ],
});
