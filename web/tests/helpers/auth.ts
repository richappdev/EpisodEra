import {expect, type Page} from "@playwright/test";

export const getSmokeCredentials = () => {
  const email = process.env.EPISODERA_TEST_EMAIL ?? process.env.EPISODERA_SMOKE_EMAIL ?? "";
  const password = process.env.EPISODERA_TEST_PASSWORD ?? process.env.EPISODERA_SMOKE_PASSWORD ?? "";
  return {email, password};
};

export const hasSmokeCredentials = () => {
  const {email, password} = getSmokeCredentials();
  return Boolean(email && password);
};

export const signIn = async (page: Page) => {
  const {email, password} = getSmokeCredentials();
  if (!email || !password) {
    throw new Error("Missing EPISODERA_TEST_EMAIL/EPISODERA_TEST_PASSWORD.");
  }

  await page.goto("/login", {waitUntil: "domcontentloaded"});
  await expect(page.getByRole("heading", {name: /Welcome back/i})).toBeVisible();
  await page.locator('[data-testid="login-email"], input[type="email"]').first().fill(email);
  await page.locator('[data-testid="login-password"], input[type="password"]').first().fill(password);
  await page.locator('[data-testid="login-submit"], form.auth-form button[type="submit"]').first().click();
  await expect(page.getByText(/^Welcome,/)).toBeVisible({timeout: 45_000});
};

export const signOut = async (page: Page) => {
  await page.goto("/home", {waitUntil: "domcontentloaded"});
  const accountButton = page.getByTestId("account-button");
  await expect(accountButton).toBeVisible();
  if (await page.getByText(/^Welcome,/).isVisible().catch(() => false)) {
    await accountButton.click();
  }
  await expect(page.getByText(/^Welcome,/)).toHaveCount(0, {timeout: 20_000});
  await expect(page.getByTestId("account-button").or(page.getByRole("link", {name: /Sign in/i})).first()).toBeVisible();
};

export const expectSignedInShell = async (page: Page) => {
  await expect(page.getByText(/^Welcome,/)).toBeVisible({timeout: 30_000});
  await expect(page.getByTestId("nav-watchlist")).toBeVisible();
  await expect(page.getByTestId("nav-profile")).toBeVisible();
};
