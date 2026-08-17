import {expect, type Locator, type Page, type TestInfo} from "@playwright/test";

export type MediaType = "tv" | "movie";

export interface SelectedMedia {
  mediaType: MediaType;
  tmdbId: string;
  title: string;
  detailUrl: string;
  overview: string;
  genres: string[];
  metadata: string;
}

export interface EpisodeSelection {
  season: number;
  episode: number;
  title: string;
  fallback: "marked-unwatched" | "already-watched";
}

const cardSelector = (mediaType?: MediaType) =>
  mediaType ? `[data-testid^="media-card-${mediaType}-"]` : '[data-testid^="media-card-"]';

const detailSelector = (mediaType?: MediaType) =>
  mediaType ? `[data-testid^="detail-${mediaType}-"]` : '[data-testid^="detail-tv-"], [data-testid^="detail-movie-"]';

export const waitForAppShell = async (page: Page) => {
  await expect(page.getByRole("heading", {name: "Episodera"})).toBeVisible({timeout: 30_000});
  await expect(page.getByTestId("nav-trending")).toBeVisible();
};

export const waitForCards = async (page: Page, mediaType?: MediaType) => {
  const cards = page.locator(cardSelector(mediaType));
  await expect(cards.first()).toBeVisible({timeout: 45_000});
  await expect(page.getByText("Loading...")).toHaveCount(0, {timeout: 45_000});
  return cards;
};

export const searchFor = async (page: Page, query: string) => {
  await page.getByTestId("nav-search").click();
  await expect(page).toHaveURL(/\/search/);
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("search-submit").click();
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(query)}`));
  await expect(page.getByText("Loading...")).toHaveCount(0, {timeout: 45_000});
};

export const openFirstCard = async (page: Page, mediaType?: MediaType, skippedTitles = new Set<string>()) => {
  const cards = await waitForCards(page, mediaType);
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const title = (await card.locator("strong").first().innerText()).trim();
    if (!skippedTitles.has(title.toLowerCase())) {
      await card.click();
      return captureDetail(page, mediaType);
    }
  }

  throw new Error(`No ${mediaType ?? "media"} card was available after skipping prior titles.`);
};

export const openSearchResult = async (
  page: Page,
  mediaType: MediaType,
  queries: string[],
  skippedTitles = new Set<string>(),
) => {
  for (const query of queries) {
    await searchFor(page, query);
    if (await page.locator(cardSelector(mediaType)).first().isVisible().catch(() => false)) {
      return openFirstCard(page, mediaType, skippedTitles);
    }
  }
  throw new Error(`No ${mediaType} search result was available for ${queries.join(", ")}.`);
};

export const captureDetail = async (page: Page, expectedType?: MediaType): Promise<SelectedMedia> => {
  await page.waitForURL(/\/(tv|movie)\/\d+/, {timeout: 45_000});
  const detail = page.locator(detailSelector(expectedType)).first();
  await expect(detail).toBeVisible({timeout: 45_000});
  await expect(detail.locator("h2")).toBeVisible();
  await expect(detail.locator(".detail-poster, img").first()).toBeVisible();
  await expect(detail.locator(".detail-facts span").first()).toBeVisible();
  await expect(detail.locator("p").first()).toBeVisible();

  const testId = (await detail.getAttribute("data-testid")) ?? "";
  const [, mediaType = expectedType ?? "tv", tmdbId = ""] = testId.match(/^detail-(tv|movie)-(\d+)$/) ?? [];
  const title = (await detail.locator("h2").innerText()).trim();
  const overview = (await detail.locator("p").first().innerText()).trim();
  const genres = (await detail.locator(".genre-row span").allInnerTexts()).map((genre) => genre.trim()).filter(Boolean);
  const metadata = (await detail.locator(".detail-facts").innerText()).trim();

  return {
    mediaType: mediaType as MediaType,
    tmdbId,
    title,
    detailUrl: page.url(),
    overview,
    genres,
    metadata,
  };
};

export const addToWatchlistOrAcceptExisting = async (page: Page, media: SelectedMedia, testInfo: TestInfo) => {
  const savedState = page.getByTestId("detail-remove-watchlist").or(page.getByTestId("detail-watchlist-status")).first();
  await expect(page.getByText("Loading progress...")).toHaveCount(0, {timeout: 30_000}).catch(() => undefined);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await savedState.isVisible().catch(() => false)) {
      await testInfo.attach("watchlist-add", {body: `${media.title} was already saved.`, contentType: "text/plain"});
      return "already-saved";
    }

    const addButton = page.getByTestId("detail-add-watchlist");
    if (await addButton.isVisible().catch(() => false)) {
      try {
        await addButton.click({timeout: 10_000});
        await expect(savedState).toBeVisible({timeout: 30_000});
        await testInfo.attach("watchlist-add", {body: `${media.title} was newly added.`, contentType: "text/plain"});
        return "added";
      } catch (error) {
        if (await savedState.isVisible().catch(() => false)) {
          await testInfo.attach("watchlist-add", {
            body: `${media.title} reached saved state while the add button was rerendering.`,
            contentType: "text/plain",
          });
          return "added";
        }
        if (attempt === 2) {
          throw error;
        }
      }
    }
  }

  await expect(savedState).toBeVisible();
  await testInfo.attach("watchlist-add", {body: `${media.title} was already saved.`, contentType: "text/plain"});
  return "already-saved";
};

export const markMovieWatchedOrVerifyExisting = async (
  page: Page,
  media: SelectedMedia,
  testInfo: TestInfo,
) => {
  if (media.mediaType !== "movie") {
    throw new Error("Movie watched-state helper received a non-movie title.");
  }

  const status = page.getByTestId("detail-watchlist-status");
  await expect(status).toBeVisible({timeout: 30_000});
  const alreadyWatched =
    (await status.getAttribute("aria-pressed")) === "true" ||
    (await status.innerText()).includes("Watched");

  if (!alreadyWatched) {
    await status.click();
    await expect(status).toHaveAttribute("aria-pressed", "true", {timeout: 30_000});
  }

  const result = alreadyWatched
    ? `${media.title} was already marked watched.`
    : `${media.title} was marked watched so its spoiler-safe discussion is eligible.`;
  await testInfo.attach("movie-watched-state", {body: result, contentType: "text/plain"});
  return alreadyWatched ? "already-watched" : "marked-watched";
};

const parseEpisode = async (row: Locator) => {
  const numberText = (await row.locator(".episode-number").innerText()).trim();
  const title = (await row.locator(".episode-copy strong").innerText()).trim();
  const match = numberText.match(/S(\d+)\s*E(\d+)/i);
  return {
    season: match ? Number(match[1]) : 1,
    episode: match ? Number(match[2]) : 1,
    title,
  };
};

export const markEpisodeWatchedOrVerifyExisting = async (page: Page, testInfo: TestInfo): Promise<EpisodeSelection> => {
  await expect(page.getByTestId("season-card-list").or(page.getByTestId("season-episode-panel")).first()).toBeVisible({
    timeout: 45_000,
  });

  const nextEpisodeButton = page.getByTestId("next-episode-mark-watched");
  if (await nextEpisodeButton.isVisible().catch(() => false)) {
    const promptText = await page.getByTestId("next-episode-prompt").innerText();
    const match = promptText.match(/S(\d+).*?E(\d+)/i);
    const titleMatch = promptText.match(/E\d+\s*[^\w\d]+?\s*([^\r\n]+)/i);
    await expect(nextEpisodeButton).toBeEnabled({timeout: 30_000});
    await nextEpisodeButton.click();
    await expect(nextEpisodeButton).toBeDisabled({timeout: 10_000}).catch(() => undefined);
    await expect(page.getByText("Loading progress...")).toHaveCount(0, {timeout: 30_000});
    const episode = {
      season: match ? Number(match[1]) : 1,
      episode: match ? Number(match[2]) : 1,
      title: titleMatch?.[1]?.trim() || "Next episode",
    };
    const logLine = `Selected next episode S${episode.season} E${episode.episode}: ${episode.title}`;
    console.log(logLine);
    await testInfo.attach("selected-episode", {body: logLine, contentType: "text/plain"});
    return {...episode, fallback: "marked-unwatched"};
  }

  const collapsedSeason = page.locator(".season-card-toggle[aria-expanded='false']").first();
  if (!(await page.getByTestId("season-episode-panel").isVisible().catch(() => false)) &&
      await collapsedSeason.isVisible().catch(() => false)) {
    await collapsedSeason.click();
  }

  await expect(page.getByTestId("season-episode-panel")).toBeVisible({timeout: 30_000});
  const rows = page.locator('[data-testid^="episode-row-"]');
  await expect(rows.first()).toBeVisible({timeout: 45_000});

  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const toggle = row.locator('[data-testid^="episode-toggle-"]');
    if (
      await toggle.getByText("Mark watched").isVisible().catch(() => false) &&
      await toggle.isEnabled().catch(() => false)
    ) {
      const episode = await parseEpisode(row);
      await toggle.click();
      await expect(toggle).toContainText("Watched", {timeout: 10_000}).catch(async () => {
        await testInfo.attach("episode-toggle-retry", {
          body: `Clicked S${episode.season} E${episode.episode}, but it did not become watched. Trying another visible episode.`,
          contentType: "text/plain",
        });
      });
      if (!(await toggle.getByText("Watched").isVisible().catch(() => false))) {
        continue;
      }
      const logLine = `Selected episode S${episode.season} E${episode.episode}: ${episode.title}`;
      console.log(logLine);
      await testInfo.attach("selected-episode", {body: logLine, contentType: "text/plain"});
      return {...episode, fallback: "marked-unwatched"};
    }
  }

  const firstWatched = rows.filter({hasText: "Watched"}).first();
  await expect(firstWatched).toBeVisible();
  const episode = await parseEpisode(firstWatched);
  const logLine = `All visible episodes were already watched; verified S${episode.season} E${episode.episode}: ${episode.title}.`;
  console.log(logLine);
  await testInfo.attach("selected-episode", {body: logLine, contentType: "text/plain"});
  return {...episode, fallback: "already-watched"};
};

export const verifyProgressVisible = async (page: Page, media: SelectedMedia) => {
  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByTestId("watchlist-header")).toBeVisible({timeout: 45_000});

  const continueCard = page.getByTestId(`continue-card-${media.tmdbId}`);
  if (await continueCard.isVisible().catch(() => false)) {
    await expect(continueCard).toContainText(media.title);
    return "continue-watching";
  }

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toBeVisible({timeout: 45_000});
  await expect(page.locator('[data-testid^="history-row-"]').filter({hasText: media.title}).first()).toBeVisible({
    timeout: 45_000,
  });
  return "profile-history";
};

export const verifyWatchlistContains = async (page: Page, media: SelectedMedia) => {
  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByTestId("watchlist-header")).toBeVisible({timeout: 45_000});
  if (await page.getByTestId("watchlist-tab-active").isVisible().catch(() => false)) {
    await page.getByTestId("watchlist-tab-active").click();
  }

  const activeItem = page.getByTestId(`watchlist-item-${media.tmdbId}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await activeItem.isVisible().catch(() => false)) {
      await expect(activeItem).toContainText(media.title);
      return "active";
    }

    const loadMore = page.getByRole("button", {name: "Load more titles"});
    if (!(await loadMore.isVisible().catch(() => false)) || await loadMore.isDisabled().catch(() => true)) {
      break;
    }
    await loadMore.click();
    await expect(page.getByText("Loading more...")).toHaveCount(0, {timeout: 30_000});
  }

  await page.getByTestId("watchlist-tab-library").click();
  const libraryItem = page.getByTestId(`library-item-${media.tmdbId}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await libraryItem.isVisible().catch(() => false)) {
      await expect(libraryItem).toContainText(media.title);
      return "library";
    }

    const loadMore = page.getByRole("button", {name: "Load more titles"});
    if (!(await loadMore.isVisible().catch(() => false)) || await loadMore.isDisabled().catch(() => true)) {
      break;
    }
    await loadMore.click();
    await expect(page.getByText("Loading more...")).toHaveCount(0, {timeout: 30_000});
  }

  await expect(page.getByText(media.title, {exact: true}).first()).toBeVisible({timeout: 15_000});
  return "visible-title";
};
