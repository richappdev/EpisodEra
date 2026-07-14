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

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "online-regression.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 18 * 60 * 1000,
  reporter: [["list"], ["json", {outputFile: "test-results/online-regression-report.json"}]],
  use: {
    baseURL: process.env.EPISODERA_HOSTING_URL ?? "https://episodera.web.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
  ],
});
