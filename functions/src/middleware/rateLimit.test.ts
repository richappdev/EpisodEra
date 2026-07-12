import assert from "node:assert/strict";
import http from "node:http";
import {Socket} from "node:net";
import test from "node:test";
import express from "express";
import {AuthenticatedRequest} from "./auth";
import {
  authenticatedWriteRateLimitKey,
  publicReadRateLimitKey,
  rateLimit,
  resetRateLimitBucketsForTests,
} from "./rateLimit";

interface JsonPayload {
  error?: {
    code?: string;
    message?: string;
  };
  ok?: boolean;
}

const request = async (
  app: express.Express,
  path: string,
  options: {headers?: Record<string, string>; method?: string} = {},
) => {
  const req = new http.IncomingMessage(new Socket());
  req.method = options.method ?? "GET";
  req.url = path;
  req.headers = options.headers ?? {};

  const res = new http.ServerResponse(req);
  const chunks: Buffer[] = [];

  return new Promise<{headers: http.OutgoingHttpHeaders; payload: JsonPayload; status: number}>((resolve, reject) => {
    const writable = res as unknown as {
      write: (chunk: unknown) => boolean;
      end: (chunk?: unknown) => http.ServerResponse;
    };

    writable.write = (chunk: unknown) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    writable.end = (chunk?: unknown) => {
      if (chunk !== undefined) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const text = Buffer.concat(chunks).toString("utf8");
      resolve({
        headers: res.getHeaders(),
        status: res.statusCode,
        payload: text ? JSON.parse(text) as JsonPayload : {},
      });
      return res;
    };

    (app as unknown as {
      handle: (request: http.IncomingMessage, response: http.ServerResponse, next: (error?: unknown) => void) => void;
    }).handle(req, res, reject);
    req.push(null);
  });
};

const createApp = () => {
  const app = express();
  app.use((req, _res, next) => {
    if (req.header("x-test-user")) {
      (req as AuthenticatedRequest).user = {uid: req.header("x-test-user")!};
    }
    next();
  });
  app.use(rateLimit({
    key: publicReadRateLimitKey,
    maxRequests: 2,
    windowMs: 60_000,
  }));
  app.use(rateLimit({
    key: authenticatedWriteRateLimitKey,
    maxRequests: 1,
    windowMs: 60_000,
  }));
  app.get("/health", (_req, res) => res.json({ok: true}));
  app.get("/search", (_req, res) => res.json({ok: true}));
  app.post("/progress/95396/episodes/batch", (_req, res) => res.json({ok: true}));
  return app;
};

test("public read rate limit is keyed by client IP and returns 429 after the configured maximum", async () => {
  resetRateLimitBucketsForTests();
  const app = createApp();

  const first = await request(app, "/search?q=silo", {headers: {"x-forwarded-for": "203.0.113.10"}});
  const second = await request(app, "/search?q=silo", {headers: {"x-forwarded-for": "203.0.113.10"}});
  const third = await request(app, "/search?q=silo", {headers: {"x-forwarded-for": "203.0.113.10"}});

  assert.equal(first.status, 200);
  assert.equal(first.headers["x-ratelimit-limit"], "2");
  assert.equal(first.headers["x-ratelimit-remaining"], "1");
  assert.equal(second.status, 200);
  assert.equal(second.headers["x-ratelimit-remaining"], "0");
  assert.equal(third.status, 429);
  assert.equal(third.payload.error?.code, "rate_limited");
});

test("authenticated write rate limit is keyed by user id", async () => {
  resetRateLimitBucketsForTests();
  const app = createApp();

  const first = await request(app, "/progress/95396/episodes/batch", {
    method: "POST",
    headers: {"x-test-user": "user-a"},
  });
  const second = await request(app, "/progress/95396/episodes/batch", {
    method: "POST",
    headers: {"x-test-user": "user-a"},
  });
  const otherUser = await request(app, "/progress/95396/episodes/batch", {
    method: "POST",
    headers: {"x-test-user": "user-b"},
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.equal(second.payload.error?.message, "Too many requests. Please retry later.");
  assert.equal(otherUser.status, 200);
});

test("health checks are not rate limited", async () => {
  resetRateLimitBucketsForTests();
  const app = createApp();

  const responses = await Promise.all([
    request(app, "/health"),
    request(app, "/health"),
    request(app, "/health"),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  assert.equal(responses[2].headers["x-ratelimit-limit"], undefined);
});
