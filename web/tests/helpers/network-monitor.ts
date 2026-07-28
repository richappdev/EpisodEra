import {expect, type Page, type TestInfo} from "@playwright/test";

const apiBaseUrl = (process.env.EPISODERA_PROD_API_BASE_URL ?? "https://api-m74gmd4u4a-uc.a.run.app").replace(/\/$/, "");
const smokeBypass = process.env.EPISODERA_SMOKE_APP_CHECK_BYPASS ?? process.env.SMOKE_BYPASS_APP_CHECK_SECRET ?? "";

const nonCriticalRequest = (url: string) =>
  /\.(avif|css|ico|jpg|jpeg|png|svg|webp|woff2?)($|\?)/i.test(url) ||
  url.includes("google-analytics.com") ||
  url.includes("googletagmanager.com") ||
  url.includes("gstatic.com/recaptcha") ||
  url.includes("firebaselogging.googleapis.com");

export interface NetworkMonitor {
  consoleErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
  unauthorizedAfterLogin: string[];
  fatalPageErrors: string[];
  noteSignedIn: () => void;
  assertHealthy: (label: string) => Promise<void>;
  attachDiagnostics: (testInfo: TestInfo, label: string) => Promise<void>;
}

export const installAppCheckBypass = async (page: Page) => {
  if (!smokeBypass) {
    return;
  }

  const apiPrefix = `${apiBaseUrl}/`;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url !== apiBaseUrl && !url.startsWith(apiPrefix)) {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-episodera-smoke-bypass": smokeBypass,
      },
    });
  });
};

export const installNetworkMonitor = (page: Page): NetworkMonitor => {
  let signedIn = false;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const serverErrors: string[] = [];
  const unauthorizedAfterLogin: string[] = [];
  const fatalPageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (/favicon|ResizeObserver loop|Failed to load resource:.*(?:analytics|font|image)/i.test(text)) {
      return;
    }
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    fatalPageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (nonCriticalRequest(url)) {
      return;
    }
    failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText ?? "failed"}`);
  });

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    if (nonCriticalRequest(url)) {
      return;
    }

    if (status >= 500) {
      serverErrors.push(`${status} ${response.request().method()} ${url}`);
    }
    if (signedIn && (status === 401 || status === 403) && url.startsWith(apiBaseUrl)) {
      unauthorizedAfterLogin.push(`${status} ${response.request().method()} ${url}`);
    }
  });

  return {
    consoleErrors,
    failedRequests,
    serverErrors,
    unauthorizedAfterLogin,
    fatalPageErrors,
    noteSignedIn: () => {
      signedIn = true;
    },
    assertHealthy: async (label: string) => {
      await expect.soft(fatalPageErrors, `${label}: unexpected page errors`).toEqual([]);
      await expect.soft(serverErrors, `${label}: unexpected 5xx responses`).toEqual([]);
      await expect.soft(unauthorizedAfterLogin, `${label}: unauthorized API responses after login`).toEqual([]);
    },
    attachDiagnostics: async (testInfo, label) => {
      await testInfo.attach(`${label}-browser-diagnostics`, {
        body: JSON.stringify(
          {consoleErrors, failedRequests, serverErrors, unauthorizedAfterLogin, fatalPageErrors, url: page.url()},
          null,
          2,
        ),
        contentType: "application/json",
      });
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        await testInfo.attach(`${label}-page`, {
          body: await page.content(),
          contentType: "text/html",
        });
      }
    },
  };
};
