import {expect, test, type Page} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DURATION_MS = Number(process.env.EPISODERA_ONLINE_REGRESSION_MS ?? String(10 * 60 * 1000));
const email = process.env.EPISODERA_SMOKE_EMAIL ?? "";
const password = process.env.EPISODERA_SMOKE_PASSWORD ?? "";
const smokeAppCheckBypass = process.env.EPISODERA_SMOKE_APP_CHECK_BYPASS ?? "";
const apiBaseUrl = (process.env.EPISODERA_PROD_API_BASE_URL ?? "https://api-m74gmd4u4a-uc.a.run.app").replace(/\/$/, "");

interface StepResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  detail?: string;
}

const visitedMediaIds = new Set<string>();
const consoleErrors: string[] = [];
const failedRequests: string[] = [];
const results: StepResult[] = [];

const record = (name: string, status: StepResult["status"], startedAt: number, detail?: string) => {
  results.push({name, status, durationMs: Date.now() - startedAt, detail});
  const label = status === "passed" ? "PASS" : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`[${label}] ${name}${detail ? ` — ${detail}` : ""} (${Date.now() - startedAt}ms)`);
};

const runStep = async (name: string, action: () => Promise<void>) => {
  const startedAt = Date.now();
  try {
    await action();
    record(name, "passed", startedAt);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    record(name, "failed", startedAt, detail);
    throw error;
  }
};

const runOptionalStep = async (name: string, action: () => Promise<void>) => {
  const startedAt = Date.now();
  try {
    await action();
    record(name, "passed", startedAt);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    record(name, "failed", startedAt, detail);
  }
};

const attachTelemetry = (page: Page) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "failed"}`);
  });
};

/** Playwright cannot mint reCAPTCHA App Check tokens; reuse the Functions smoke bypass for live UI runs. */
const attachAppCheckSmokeBypass = async (page: Page) => {
  if (!smokeAppCheckBypass) {
    return;
  }

  const apiPrefix = `${apiBaseUrl}/`;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(apiPrefix) && url !== apiBaseUrl) {
      await route.continue();
      return;
    }

    const headers = {
      ...route.request().headers(),
      "x-episodera-smoke-bypass": smokeAppCheckBypass,
    };
    await route.continue({headers});
  });
};

const isSignedIn = async (page: Page) => page.getByText(/^Welcome,/).isVisible();

const expectSignedOut = async (page: Page) => {
  await expect(page.getByText(/^Welcome,/)).toHaveCount(0, {timeout: 15_000});
  await expect(page.getByTestId("account-button")).toContainText(/Sign in|登入/, {timeout: 15_000});
};

const clearAuthPersistence = async (page: Page) => {
  await page.context().clearCookies();
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    const databases = await (indexedDB.databases?.() ?? Promise.resolve([]));
    await Promise.all(
      databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name))
        .map(
          (name) =>
            new Promise<void>((resolve, reject) => {
              const request = indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
              request.onblocked = () => resolve();
            }),
        ),
    );
  });
};

const signIn = async (page: Page) => {
  if (!email || !password) {
    throw new Error("Missing EPISODERA_SMOKE_EMAIL or EPISODERA_SMOKE_PASSWORD.");
  }

  if (await isSignedIn(page)) {
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form.auth-form button[type='submit']").click();
  await expect(page.getByText(/^Welcome,/)).toBeVisible({timeout: 30_000});
};

const signOut = async (page: Page) => {
  await page.goto("/home");
  if (await isSignedIn(page)) {
    await page.getByTestId("account-button").click();
    await expect(page.getByText(/^Welcome,/)).toHaveCount(0, {timeout: 15_000}).catch(() => undefined);
  }

  // Firebase IndexedDB persistence can restore the session after a plain UI sign-out.
  await clearAuthPersistence(page);
  await page.goto("/home");
  await expectSignedOut(page);
};

const getUnvisitedCard = async (page: Page, mediaType?: "tv" | "movie") => {
  const selector = mediaType ? `[data-testid^="media-card-${mediaType}-"]` : '[data-testid^="media-card-"]';
  const cards = page.locator(selector);
  const count = await cards.count();

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const testId = await card.getAttribute("data-testid");
    if (!testId || visitedMediaIds.has(testId)) {
      continue;
    }

    return {card, testId};
  }

  return null;
};

const openUniqueMediaCard = async (page: Page, label: string, mediaType?: "tv" | "movie") => {
  const next = await getUnvisitedCard(page, mediaType);
  if (!next) {
    return null;
  }

  visitedMediaIds.add(next.testId);
  await next.card.click();
  await page.waitForURL(/\/(tv|movie)\/\d+/, {timeout: 30_000});
  await expect(page.locator('[data-testid^="detail-tv-"], [data-testid^="detail-movie-"]').first()).toBeVisible({timeout: 30_000});
  return next.testId;
};

const openUniqueMediaCardOrLoadMore = async (page: Page, label: string, mediaType: "tv" | "movie") => {
  let opened = await openUniqueMediaCard(page, label, mediaType);
  if (opened) {
    return opened;
  }

  const loadMore = page.getByRole("button", {name: "Load more results"});
  if (await loadMore.isVisible().catch(() => false)) {
    await loadMore.click();
    await waitForTrendingCards(page, mediaType);
    opened = await openUniqueMediaCard(page, label, mediaType);
    if (opened) {
      return opened;
    }
  }

  const query = mediaType === "tv" ? "Drama series" : "Action film";
  await searchFor(page, query);
  opened = await openUniqueMediaCard(page, `${label} via search`, mediaType);
  if (!opened) {
    throw new Error(`No unvisited ${mediaType} cards available for ${label}.`);
  }

  return opened;
};

const goBackFromDetail = async (page: Page) => {
  const back = page.getByRole("button", {name: "Back"});
  if (await back.isVisible()) {
    await back.click();
    return;
  }

  await page.goBack();
};

const waitForTrendingCards = async (page: Page, mediaType: "tv" | "movie") => {
  const cards = page.locator(`[data-testid^="media-card-${mediaType}-"]`);
  const rateLimited = page.getByText("Too many requests. Please retry later.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await cards.first().isVisible().catch(() => false)) {
      await expect(page.getByText("Loading...")).toHaveCount(0, {timeout: 30_000});
      return cards;
    }

    if (await rateLimited.first().isVisible().catch(() => false)) {
      const retry = page.getByRole("button", {name: "Retry"}).first();
      if (await retry.isVisible().catch(() => false)) {
        await retry.click();
      }
      await page.waitForTimeout(2_500 * (attempt + 1));
      continue;
    }

    await page.waitForTimeout(1_000);
  }

  await expect(cards.first()).toBeVisible({timeout: 30_000});
  await expect(page.getByText("Loading...")).toHaveCount(0, {timeout: 30_000});
  return cards;
};

const assertTrendingCards = async (page: Page, mediaType: "tv" | "movie") => {
  const cards = await waitForTrendingCards(page, mediaType);
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(10);
  await expect(cards.first().getByText(mediaType === "movie" ? "Movie" : "TV")).toBeVisible();
};

const openProfileWithStats = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByTestId("nav-profile").click();
    await expect(page).toHaveURL(/\/profile/);

    const stats = page.getByTestId("stat-watched-episodes");
    if (await stats.isVisible().catch(() => false)) {
      return;
    }

    const retry = page.getByRole("button", {name: "Retry"}).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
      await page.waitForTimeout(1_000);
      if (await stats.isVisible().catch(() => false)) {
        return;
      }
    }

    await page.reload({waitUntil: "domcontentloaded"});
    await page.waitForTimeout(1_000);
  }

  await expect(page.getByTestId("stat-watched-episodes")).toBeVisible({timeout: 30_000});
};

const searchFor = async (page: Page, query: string) => {
  await page.getByTestId("nav-search").click();
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("search-submit").click();
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(query)}`));
};

const waitForSettingsReady = async (page: Page) => {
  const languageSelect = page.locator("select").first();
  await expect(languageSelect).toBeEnabled({timeout: 30_000});
  await expect(page.getByText(/Saving settings|正在儲存設定/)).toHaveCount(0, {timeout: 30_000});
  return languageSelect;
};

const soakUntil = async (page: Page, deadline: number) => {
  const navTargets = ["nav-trending", "nav-search", "nav-watchlist", "nav-profile", "nav-settings"] as const;
  const searchQueries = ["Arcane", "Dune", "Breaking Bad", "Inception", "The Bear", "Avatar"];
  let soakIndex = 0;

  while (Date.now() < deadline) {
    const action = soakIndex % 5;
    soakIndex += 1;

    try {
      if (action === 0) {
        await page.getByTestId(navTargets[soakIndex % navTargets.length]).click();
        await page.waitForTimeout(1_200);
        continue;
      }

      if (action === 1) {
        await page.getByTestId("nav-trending").click();
        const tab = soakIndex % 2 === 0 ? "TV Shows" : "Movies";
        await page.getByRole("tab", {name: tab}).click();
        await assertTrendingCards(page, tab === "TV Shows" ? "tv" : "movie");
        await page.waitForTimeout(1_200);
        continue;
      }

      if (action === 2) {
        const query = searchQueries[soakIndex % searchQueries.length];
        await searchFor(page, query);
        await page.waitForTimeout(1_500);
        continue;
      }

      if (action === 3) {
        await page.getByTestId("nav-trending").click();
        await page.getByRole("tab", {name: "TV Shows"}).click();
        await waitForTrendingCards(page, "tv");
        const opened = await openUniqueMediaCardOrLoadMore(page, "soak TV detail", "tv");
        await expect(page.locator('[data-testid^="detail-tv-"]')).toBeVisible();
        await goBackFromDetail(page);
        record(`soak unique detail ${opened}`, "passed", Date.now());
        continue;
      }

      await page.getByTestId("nav-trending").click();
      await page.getByRole("tab", {name: "Movies"}).click();
      await waitForTrendingCards(page, "movie");
      const opened = await openUniqueMediaCardOrLoadMore(page, "soak movie detail", "movie");
      await expect(page.locator('[data-testid^="detail-movie-"]')).toBeVisible();
      await goBackFromDetail(page);
      record(`soak unique detail ${opened}`, "passed", Date.now());
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      record(`soak action ${action} recovered`, "skipped", Date.now(), detail.slice(0, 160));
      const retry = page.getByRole("button", {name: "Retry"}).first();
      if (await retry.isVisible().catch(() => false)) {
        await retry.click().catch(() => undefined);
      }
      await page.waitForTimeout(3_000);
    }
  }
};

test("online UI regression soak — 10 minutes, no repeated media clicks", async ({page, browser}) => {
  test.setTimeout(18 * 60 * 1000);

  if (!email || !password) {
    test.skip(true, "Smoke credentials are not configured in web/.env.smoke.");
  }

  if (!smokeAppCheckBypass) {
    test.skip(true, "EPISODERA_SMOKE_APP_CHECK_BYPASS is required for live authenticated UI checks.");
  }

  attachTelemetry(page);
  await attachAppCheckSmokeBypass(page);
  const startedAt = Date.now();
  const deadline = startedAt + DURATION_MS;

  await runStep("P0 load deployed app and trending shell", async () => {
    await page.goto("/home");
    await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible();
    await expect(page.getByTestId("nav-trending")).toBeVisible();
    await expect(page.getByRole("heading", {name: "Trending TV Shows"})).toBeVisible({timeout: 30_000});
  });

  await runStep("P0 sign in with smoke account", async () => {
    await signIn(page);
  });

  await runStep("P0 trending TV cards render with metadata", async () => {
    await page.getByTestId("nav-trending").click();
    await page.getByRole("tab", {name: "TV Shows"}).click();
    await assertTrendingCards(page, "tv");
  });

  await runStep("P0 switch to Movies tab and verify movie grid", async () => {
    await page.getByRole("tab", {name: "Movies"}).click();
    await expect(page.getByRole("heading", {name: "Trending Movies"})).toBeVisible({timeout: 30_000});
    await assertTrendingCards(page, "movie");
  });

  await runStep("P0 open unique TV detail and verify fields", async () => {
    await page.getByTestId("nav-trending").click();
    await page.getByRole("tab", {name: "TV Shows"}).click();
    await waitForTrendingCards(page, "tv");
    const testId = await openUniqueMediaCardOrLoadMore(page, "TV detail", "tv");
    await expect(page.locator("h2")).toBeVisible();
    await expect(page.getByText(/TV|Movie/)).toBeVisible();
    await expect(page.locator(".detail-hero p").first()).toBeVisible();
    await expect(page.locator(".genre-row span").first()).toBeVisible();
    record(`visited ${testId}`, "passed", Date.now());
    await goBackFromDetail(page);
  });

  await runStep("P0 open unique movie detail without episode controls", async () => {
    await page.getByTestId("nav-trending").click();
    await page.getByRole("tab", {name: "Movies"}).click();
    await waitForTrendingCards(page, "movie");
    const testId = await openUniqueMediaCardOrLoadMore(page, "movie detail", "movie");
    await expect(page.locator('[data-testid^="detail-movie-"]')).toBeVisible();
    await expect(page.getByTestId("mark-season-watched")).toHaveCount(0);
    record(`visited ${testId}`, "passed", Date.now());
    await goBackFromDetail(page);
  });

  await runOptionalStep("P1 search TV title Silo", async () => {
    await searchFor(page, "Silo");
    await expect(page.getByRole("heading", {name: "TV Shows"})).toBeVisible({timeout: 30_000});
    const opened = await openUniqueMediaCard(page, "search TV result", "tv");
    if (!opened) {
      throw new Error("Search did not return an unvisited TV card.");
    }
    record(`visited ${opened}`, "passed", Date.now());
    await goBackFromDetail(page);
  });

  await runOptionalStep("P1 search movie title", async () => {
    await searchFor(page, "Matrix");
    await expect(page.getByRole("heading", {name: "Movies"})).toBeVisible({timeout: 30_000});
    const opened = await openUniqueMediaCard(page, "search movie result", "movie");
    if (!opened) {
      throw new Error("Search did not return an unvisited movie card.");
    }
    record(`visited ${opened}`, "passed", Date.now());
    await goBackFromDetail(page);
  });

  await runOptionalStep("P1 search no-result state", async () => {
    await searchFor(page, "zzzz-no-match-episodera-ui-regression");
    await expect(page.getByText(/No results|no results/i)).toBeVisible({timeout: 30_000});
  });

  await runStep("P0 watchlist page renders for signed-in user", async () => {
    await page.getByTestId("nav-watchlist").click();
    await expect(page.getByTestId("watchlist-header")).toBeVisible({timeout: 30_000});
  });

  await runStep("P0 profile stats render for signed-in user", async () => {
    await openProfileWithStats(page);
    await expect(page.getByTestId("stat-watchlist-count")).toBeVisible();
  });

  await runOptionalStep("P1 settings language switch zh-TW and restore English", async () => {
    await page.getByTestId("nav-settings").click();
    const languageSelect = await waitForSettingsReady(page);
    await languageSelect.selectOption("zh-TW");
    await waitForSettingsReady(page);
    await expect(page.getByRole("heading", {name: "設定"})).toBeVisible({timeout: 15_000});
    await languageSelect.selectOption("en-US");
    await waitForSettingsReady(page);
    await expect(page.getByRole("heading", {name: "Settings"})).toBeVisible({timeout: 15_000});
  });

  await runOptionalStep("P1 privacy page renders signed in", async () => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading")).toBeVisible();
    await expect(page.getByRole("link", {name: "support@episodera.web.app"})).toBeVisible();
  });

  await runStep("P1 responsive desktop shell", async () => {
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto("/home");
    await expect(page.getByTestId("nav-trending")).toBeVisible();
    await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible();
  });

  await runOptionalStep("P1 responsive mobile shell", async () => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/home");
    await expect(page.getByTestId("nav-trending")).toBeVisible();
    await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible();
  });

  await runStep("P0 sign out shows signed-out nav", async () => {
    await page.setViewportSize({width: 1280, height: 800});
    await signOut(page);
    await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Trending TV Shows"})).toBeVisible({timeout: 30_000});
    await expectSignedOut(page);
  });

  await runStep("P0 signed-out root shows marketing landing", async () => {
    await page.goto("/");
    await expect(page.getByTestId("nav-trending")).toHaveCount(0);
    await expect(page.locator(".landing-brand-mark")).toBeVisible();
    await expect(page.getByRole("link", {name: /Create free account|免費建立帳號/})).toBeVisible();
  });

  await runStep("P1 signed-out trending remains public", async () => {
    // Fresh context avoids Firebase IndexedDB persistence races from the signed-in session.
    const signedOutContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL as string | undefined,
      viewport: {width: 1280, height: 800},
    });
    const signedOutPage = await signedOutContext.newPage();
    try {
      attachTelemetry(signedOutPage);
      await attachAppCheckSmokeBypass(signedOutPage);
      await signedOutPage.goto("/home");
      await expectSignedOut(signedOutPage);
      await assertTrendingCards(signedOutPage, "tv");
      const opened = await openUniqueMediaCardOrLoadMore(signedOutPage, "signed-out detail", "tv");
      await expect(signedOutPage.locator(".auth-note")).toContainText(/Sign in to save this title/i, {
        timeout: 15_000,
      });
      record(`visited ${opened}`, "passed", Date.now());
    } finally {
      await signedOutContext.close();
    }
  });

  await runStep("P0 re-sign in restores authenticated shell", async () => {
    await signIn(page);
    await page.getByTestId("nav-watchlist").click();
    await expect(page.getByTestId("watchlist-header")).toBeVisible({timeout: 30_000});
  });

  const soakStartedAt = Date.now();
  const soakDeadline = Math.max(deadline, soakStartedAt);
  const remainingMs = deadline - Date.now();

  if (remainingMs > 0) {
    console.log(`Starting soak phase for ${Math.round(remainingMs / 1000)}s (unique media only).`);
    await soakUntil(page, deadline);
    record("P2 soak phase completed", "passed", soakStartedAt, `${Math.round((Date.now() - soakStartedAt) / 1000)}s`);
  } else {
    record("P2 soak phase", "skipped", Date.now(), "structured scenarios consumed full duration");
  }

  await runStep("Final profile and watchlist consistency check", async () => {
    await page.getByTestId("nav-watchlist").click();
    await expect(page.getByTestId("watchlist-header")).toBeVisible();
    await openProfileWithStats(page);
    await expect(page.getByText(/^Welcome,/)).toBeVisible();
  });

  const totalMs = Date.now() - startedAt;
  const passed = results.filter((entry) => entry.status === "passed").length;
  const failed = results.filter((entry) => entry.status === "failed").length;
  const skipped = results.filter((entry) => entry.status === "skipped").length;
  const summary = {
    targetUrl: test.info().project.use.baseURL,
    durationMs: totalMs,
    durationMinutes: Number((totalMs / 60_000).toFixed(2)),
    uniqueMediaVisited: visitedMediaIds.size,
    passed,
    failed,
    skipped,
    consoleErrorCount: consoleErrors.length,
    failedRequestCount: failedRequests.length,
    consoleErrors: consoleErrors.slice(0, 20),
    failedRequests: failedRequests.slice(0, 20),
    steps: results,
    visitedMediaIds: [...visitedMediaIds],
  };

  const reportDir = path.resolve(process.cwd(), "test-results");
  fs.mkdirSync(reportDir, {recursive: true});
  fs.writeFileSync(path.join(reportDir, "online-regression-summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== Online UI Regression Summary ===");
  console.log(`Duration: ${summary.durationMinutes} min`);
  console.log(`Steps: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`Unique media visited: ${visitedMediaIds.size}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`Failed network requests: ${failedRequests.length}`);

  expect(failed, `Regression had ${failed} failed step(s)`).toBe(0);
  expect(totalMs).toBeGreaterThanOrEqual(DURATION_MS - 5_000);
});
