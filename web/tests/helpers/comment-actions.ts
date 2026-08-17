import {expect, type Page, type TestInfo} from "@playwright/test";
import {buildComment, normalizedComment, shouldAttemptComment} from "./comment-generator";
import {recentCommentMatches, recordComment, titleHadRecentComment, visibleCommentBodies} from "./account-state";
import type {SelectedMedia} from "./media-selection";

export interface CommentResult {
  status: "posted" | "skipped" | "verified-existing";
  body?: string;
  reason?: string;
}

const currentUserName = async (page: Page) => {
  const text = await page.getByText(/^Welcome,/).first().innerText().catch(() => "");
  return text.replace(/^Welcome,\s*/i, "").trim();
};

export const maybeCreateComment = async (
  page: Page,
  media: SelectedMedia,
  testInfo: TestInfo,
  options: {force?: boolean; episodeTitle?: string} = {},
): Promise<CommentResult> => {
  await expect(page.getByTestId("discussion-panel")).toBeVisible({timeout: 30_000});
  await expect(page.getByText("Loading discussion...")).toHaveCount(0, {timeout: 30_000});

  const input = page.getByTestId("discussion-input");
  if (!(await input.isVisible().catch(() => false))) {
    const reason = "Discussion input is unavailable, likely because the title is not eligible for comments.";
    await testInfo.attach("comment-skip", {body: reason, contentType: "text/plain"});
    return {status: "skipped", reason};
  }

  const shouldPost = options.force || shouldAttemptComment();
  if (!shouldPost) {
    const reason = "Comment probability skipped this run.";
    await testInfo.attach("comment-skip", {body: reason, contentType: "text/plain"});
    return {status: "skipped", reason};
  }

  const userName = await currentUserName(page);
  const visibleBodies = await visibleCommentBodies(page);
  const visibleOwnComment = userName
    ? visibleBodies.find((body) => body.includes(userName) && !/Hidden until you watch this title/i.test(body))
    : undefined;
  if (visibleOwnComment) {
    const reason = `${media.title} already has a visible account comment.`;
    await testInfo.attach("comment-existing", {body: reason, contentType: "text/plain"});
    return {status: "verified-existing", body: visibleOwnComment, reason};
  }

  if (titleHadRecentComment(media)) {
    const reason = `${media.title} has a recent recorded account comment, but it was not visible enough to verify safely.`;
    await testInfo.attach("comment-skip", {body: reason, contentType: "text/plain"});
    return {status: "skipped", reason};
  }

  const body = buildComment(media, {episodeTitle: options.episodeTitle});
  const normalized = normalizedComment(body);
  const duplicateVisible = visibleBodies.some((existing) => normalizedComment(existing).includes(normalized));
  if (duplicateVisible || recentCommentMatches(body)) {
    const reason = "Proposed comment was duplicate or near-duplicate.";
    await testInfo.attach("comment-skip", {body: reason, contentType: "text/plain"});
    return {status: "skipped", reason};
  }

  await input.fill(body);
  await page.getByTestId("discussion-submit").click();
  await expect(page.locator('[data-testid^="discussion-"]').first()).toContainText(body, {timeout: 30_000});
  recordComment(media, body);
  await testInfo.attach("submitted-comment", {body, contentType: "text/plain"});
  console.log(`Submitted comment for ${media.title}: ${body}`);
  return {status: "posted", body};
};
