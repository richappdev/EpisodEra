#!/usr/bin/env node
/**
 * Trigger hosted Production Smoke for the current release candidate.
 *
 * Requires GitHub CLI (`gh`) authenticated to this repository.
 *
 * Usage:
 *   node scripts/trigger-production-smoke.mjs
 *   node scripts/trigger-production-smoke.mjs --ref main
 *   node scripts/trigger-production-smoke.mjs --watch
 *   node scripts/trigger-production-smoke.mjs --api-base-url https://api-m74gmd4u4a-uc.a.run.app
 *   node scripts/trigger-production-smoke.mjs --show-id 125988
 *
 * Or from web/:
 *   npm run smoke:rc
 *   npm run smoke:rc -- --watch
 */

import {execFileSync, spawnSync} from "node:child_process";

const WORKFLOW = "Production Smoke";
const DEFAULT_API = "https://api-m74gmd4u4a-uc.a.run.app";
const DEFAULT_SHOW_ID = "125988";

function parseArgs(argv) {
  const args = {
    ref: null,
    watch: false,
    apiBaseUrl: DEFAULT_API,
    showId: DEFAULT_SHOW_ID,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--watch") {
      args.watch = true;
    } else if (token === "--ref") {
      args.ref = argv[++i] ?? null;
    } else if (token === "--api-base-url") {
      args.apiBaseUrl = argv[++i] ?? DEFAULT_API;
    } else if (token === "--show-id") {
      args.showId = argv[++i] ?? DEFAULT_SHOW_ID;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function runGh(args, {stdio = "pipe"} = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio,
  });
}

function tryRunGh(args) {
  const result = spawnSync("gh", args, {encoding: "utf8"});
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function printHelp() {
  console.log(`Trigger GitHub Actions "Production Smoke" for a release candidate.

Usage:
  node scripts/trigger-production-smoke.mjs [options]

Options:
  --ref <branch|sha>     Git ref to run against (default: current branch)
  --api-base-url <url>   Deployed API base URL
  --show-id <tmdbId>     Smoke show ID (default: ${DEFAULT_SHOW_ID})
  --watch                Wait for the run to finish and exit non-zero on failure
  -h, --help             Show this help

After a Functions/Hosting deploy, run this on the deployed tip, then paste the
workflow URL into Notion Engineering Release Log.
`);
}

function currentBranch() {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function currentShortSha() {
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function currentFullSha() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function ensureGh() {
  const version = tryRunGh(["--version"]);
  if (!version.ok) {
    throw new Error(
      "GitHub CLI (`gh`) is required. Install from https://cli.github.com/ and run `gh auth login`.",
    );
  }
  const auth = tryRunGh(["auth", "status"]);
  if (!auth.ok) {
    throw new Error("`gh` is not authenticated. Run `gh auth login` and retry.");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findLatestRun(ref) {
  const list = tryRunGh([
    "run",
    "list",
    "--workflow",
    WORKFLOW,
    "--limit",
    "8",
    "--json",
    "databaseId,url,headBranch,headSha,status,createdAt,event,displayTitle",
  ]);
  if (!list.ok) {
    return null;
  }
  const runs = JSON.parse(list.stdout);
  const short = currentShortSha();
  const full = currentFullSha();
  return (
    runs.find(
      (run) =>
        run.event === "workflow_dispatch" &&
        (run.headBranch === ref ||
          run.headSha === full ||
          (typeof run.headSha === "string" && run.headSha.startsWith(short))),
    ) ??
    runs.find((run) => run.event === "workflow_dispatch") ??
    runs[0] ??
    null
  );
}

async function waitForRun(ref, {attempts = 12, delayMs = 2500} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const run = findLatestRun(ref);
    if (run?.databaseId) {
      return run;
    }
    await sleep(delayMs);
  }
  return null;
}

function releaseLogSnippet({sha, runUrl, apiBaseUrl, showId}) {
  const today = new Date().toISOString().slice(0, 10);
  return `## ${today} — \`${sha}\`
**Summary:** Release-candidate Production Smoke after deploy.
**Deployed:** Confirm Hosting / Functions / Firestore from this tip.
**Evidence:**
- Workflow: ${runUrl ?? "(paste Production Smoke run URL)"}
- Covered paths: health, profile, watchlist, progress, stats, history, App Check enforce probe, import path (\`stagingClearedAt\`)
- Negative checks: invalid auth 401, CORS 403, rate-limit 429 (unless skipped)
- API: ${apiBaseUrl}
- Smoke show ID: ${showId}
- Result: PASS / FAIL
**Known exclusions:**
**Rollback target:**
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  ensureGh();

  const ref = args.ref ?? currentBranch();
  const sha = currentShortSha();

  console.log(`Dispatching "${WORKFLOW}" on ref \`${ref}\` (local tip ${sha})…`);

  runGh(
    [
      "workflow",
      "run",
      WORKFLOW,
      "--ref",
      ref,
      "-f",
      `api_base_url=${args.apiBaseUrl}`,
      "-f",
      `smoke_show_id=${args.showId}`,
      "-f",
      "release_candidate=true",
    ],
    {stdio: "inherit"},
  );

  const run = await waitForRun(ref);
  const runUrl = run?.url ?? null;

  if (!runUrl) {
    console.log("Dispatched. Open Actions → Production Smoke for the run URL.");
  } else {
    console.log(`Workflow run: ${runUrl}`);
  }

  console.log("\n--- Paste into Notion Engineering Release Log ---\n");
  console.log(
    releaseLogSnippet({
      sha,
      runUrl,
      apiBaseUrl: args.apiBaseUrl,
      showId: args.showId,
    }),
  );

  if (!args.watch) {
    console.log("Tip: re-run with --watch to block until the hosted smoke finishes.");
    return;
  }

  if (!run?.databaseId) {
    console.warn("--watch requested but no run id was found yet. Check Actions manually.");
    process.exitCode = 1;
    return;
  }

  console.log("Watching run until completion…");
  const watched = spawnSync("gh", ["run", "watch", String(run.databaseId), "--exit-status"], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (watched.status !== 0) {
    process.exitCode = watched.status ?? 1;
    console.error(
      "Production Smoke did not succeed. Inspect the workflow log before claiming the RC.",
    );
    return;
  }
  console.log("Production Smoke finished successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
