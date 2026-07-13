#!/usr/bin/env node
/**
 * Verifies EpisodEra Firebase project configuration against the repo and live endpoints.
 *
 * Usage (from repo root, with Node and Firebase CLI login):
 *   node scripts/verify-firebase-project.mjs
 *
 * Optional env:
 *   EXPECTED_PROJECT_ID=episodera
 *   PROD_API_BASE_URL=https://api-m74gmd4u4a-uc.a.run.app
 *   PROD_HOSTING_URL=https://episodera.web.app
 */

import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedProjectId = process.env.EXPECTED_PROJECT_ID ?? "episodera";
const prodApiBaseUrl = (process.env.PROD_API_BASE_URL ?? "https://api-m74gmd4u4a-uc.a.run.app").replace(/\/$/, "");
const legacyApiBaseUrl = `https://us-central1-${expectedProjectId}.cloudfunctions.net/api`;
const prodHostingUrl = (process.env.PROD_HOSTING_URL ?? "https://episodera.web.app").replace(/\/$/, "");

const firebaseBin = path.join(repoRoot, "functions", "node_modules", ".bin", process.platform === "win32" ? "firebase.cmd" : "firebase");

const results = [];

const pass = (label, detail) => {
  results.push({status: "pass", label, detail});
  console.log(`PASS  ${label}${detail ? `: ${detail}` : ""}`);
};

const warn = (label, detail) => {
  results.push({status: "warn", label, detail});
  console.warn(`WARN  ${label}${detail ? `: ${detail}` : ""}`);
};

const fail = (label, detail) => {
  results.push({status: "fail", label, detail});
  console.error(`FAIL  ${label}${detail ? `: ${detail}` : ""}`);
};

const runFirebase = (args) => {
  if (!fs.existsSync(firebaseBin)) {
    throw new Error(`Firebase CLI not found at ${firebaseBin}. Run: cd functions && npm install`);
  }

  return execFileSync(firebaseBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
};

const fetchJson = async (url) => {
  const response = await fetch(url, {redirect: "follow"});
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return {ok: response.ok, status: response.status, body};
};

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

console.log("EpisodEra Firebase project verification\n");

try {
  const firebaserc = readJson(".firebaserc");
  const defaultProject = firebaserc?.projects?.default;
  if (defaultProject === expectedProjectId) {
    pass("Repo project ID", `.firebaserc default is ${defaultProject}`);
  } else {
    fail("Repo project ID", `expected ${expectedProjectId}, found ${defaultProject ?? "none"}`);
  }
} catch (error) {
  fail("Repo project ID", error instanceof Error ? error.message : String(error));
}

try {
  const firebaseJson = readJson("firebase.json");
  const services = Object.keys(firebaseJson).filter((key) => key !== "emulators");
  pass("Configured Firebase services", services.join(", "));

  const emulatorNames = Object.keys(firebaseJson.emulators ?? {}).filter((key) => key !== "ui" && key !== "singleProjectMode");
  pass("Configured emulators", emulatorNames.join(", "));
} catch (error) {
  fail("firebase.json", error instanceof Error ? error.message : String(error));
}

try {
  const version = runFirebase(["--version"]);
  pass("Firebase CLI", version);
} catch (error) {
  fail("Firebase CLI", error instanceof Error ? error.message : String(error));
}

try {
  const activeProject = runFirebase(["use"]);
  if (activeProject.includes(expectedProjectId)) {
    pass("Active Firebase project", activeProject.replace(/\s+/g, " "));
  } else {
    warn("Active Firebase project", `${activeProject} (expected ${expectedProjectId})`);
  }
} catch (error) {
  warn("Active Firebase project", error instanceof Error ? error.message : String(error));
}

try {
  const login = runFirebase(["login:list"]);
  if (login.toLowerCase().includes("no authorized accounts")) {
    warn("Firebase login", "No authorized accounts. Run: npx -y firebase-tools@latest login");
  } else {
    pass("Firebase login", login.split("\n")[0]);
  }
} catch (error) {
  warn("Firebase login", error instanceof Error ? error.message : String(error));
}

try {
  const apps = runFirebase(["apps:list", "--project", expectedProjectId, "--json"]);
  const parsed = JSON.parse(apps);
  const appCount = parsed?.result?.length ?? 0;
  if (appCount > 0) {
    pass("Registered Firebase apps", `${appCount} app(s)`);
    for (const appInfo of parsed.result ?? []) {
      console.log(`      - ${appInfo.platform}: ${appInfo.displayName ?? appInfo.appId}`);
    }
  } else {
    warn("Registered Firebase apps", "No apps returned");
  }
} catch (error) {
  warn("Registered Firebase apps", error instanceof Error ? error.message : String(error));
}

for (const [label, url] of [
  ["Production API (Cloud Run)", `${prodApiBaseUrl}/health`],
  ["Production API (legacy Functions URL)", `${legacyApiBaseUrl}/health`],
  ["Production Hosting", prodHostingUrl],
]) {
  try {
    const response = await fetchJson(url);
    if (label.includes("API") && response.ok && response.body?.ok === true) {
      pass(label, `${url} -> ${response.status}`);
    } else if (label.includes("Hosting") && response.ok) {
      pass(label, `${url} -> ${response.status}`);
    } else {
      warn(label, `${url} -> HTTP ${response.status}`);
    }
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

const summary = {
  pass: results.filter((item) => item.status === "pass").length,
  warn: results.filter((item) => item.status === "warn").length,
  fail: results.filter((item) => item.status === "fail").length,
};

console.log(`\nSummary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed`);
process.exit(summary.fail > 0 ? 1 : 0);
