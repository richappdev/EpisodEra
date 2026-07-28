import fs from "node:fs";
import path from "node:path";
import type {Page} from "@playwright/test";
import {normalizedComment} from "./comment-generator";
import type {SelectedMedia} from "./media-selection";

interface AccountState {
  comments: Array<{
    mediaType: SelectedMedia["mediaType"];
    tmdbId: string;
    title: string;
    normalizedBody: string;
    createdAt: string;
  }>;
}

const statePath = path.resolve(process.cwd(), "test-results", "smoke-account-state.json");

const emptyState = (): AccountState => ({comments: []});

export const readAccountState = (): AccountState => {
  if (!fs.existsSync(statePath)) {
    return emptyState();
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8")) as AccountState;
  } catch {
    return emptyState();
  }
};

export const recordComment = (media: SelectedMedia, body: string) => {
  const state = readAccountState();
  state.comments.unshift({
    mediaType: media.mediaType,
    tmdbId: media.tmdbId,
    title: media.title,
    normalizedBody: normalizedComment(body),
    createdAt: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(statePath), {recursive: true});
  fs.writeFileSync(statePath, JSON.stringify({...state, comments: state.comments.slice(0, 100)}, null, 2));
};

export const recentCommentMatches = (body: string) => {
  const normalized = normalizedComment(body);
  return readAccountState().comments.some((comment) => {
    if (comment.normalizedBody === normalized) {
      return true;
    }
    return comment.normalizedBody.includes(normalized) || normalized.includes(comment.normalizedBody);
  });
};

export const titleHadRecentComment = (media: SelectedMedia) =>
  readAccountState().comments.some((comment) => comment.mediaType === media.mediaType && comment.tmdbId === media.tmdbId);

export const visibleCommentBodies = async (page: Page) => {
  const comments = page.locator('[data-testid^="discussion-"]');
  const count = await comments.count();
  const bodies: string[] = [];
  for (let index = 0; index < count; index += 1) {
    bodies.push(await comments.nth(index).innerText());
  }
  return bodies;
};
