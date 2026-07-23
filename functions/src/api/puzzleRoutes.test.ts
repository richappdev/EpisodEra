import assert from "node:assert/strict";
import http from "node:http";
import {Socket} from "node:net";
import test from "node:test";
import express, {ErrorRequestHandler} from "express";
import {AuthenticatedRequest} from "../middleware/auth";
import {HttpError} from "../lib/httpError";
import {DailyPuzzleResponse} from "../models/puzzle";
import {puzzleRouter} from "./puzzleRoutes";
import {autoPuzzleService} from "../services/autoPuzzleService";
import {puzzleService} from "../services/puzzleService";

interface JsonPayload {
  error?: {
    code?: string;
    message?: string;
  };
  puzzleId?: string;
  [key: string]: unknown;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({error: {code: error.code, message: error.message}});
    return;
  }
  res.status(500).json({error: {code: "internal", message: "Internal server error."}});
};

const createTestApp = (options?: {adminEmail?: string}) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = options?.adminEmail
      ? {uid: "admin-user", email: options.adminEmail}
      : undefined;
    next();
  });
  app.use("/", puzzleRouter);
  app.use(errorHandler);
  return app;
};

const request = async (
  app: express.Express,
  path: string,
  options: {body?: unknown; method?: string; headers?: Record<string, string>} = {},
) => {
  const req = new http.IncomingMessage(new Socket());
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  req.method = options.method ?? "GET";
  req.url = path;
  req.headers = {
    ...(options.headers ?? {}),
    ...(body === null
      ? {}
      : {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
        }),
  };

  const res = new http.ServerResponse(req);
  const chunks: Buffer[] = [];

  return new Promise<{payload: JsonPayload; status: number}>((resolve, reject) => {
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
        status: res.statusCode,
        payload: text ? JSON.parse(text) as JsonPayload : {},
      });
      return res;
    };

    (app as unknown as {
      handle: (request: http.IncomingMessage, response: http.ServerResponse, next: (error?: unknown) => void) => void;
    }).handle(req, res, reject);
    if (body !== null) {
      req.push(body);
    }
    req.push(null);
  });
};

const puzzleFixture: DailyPuzzleResponse = {
  id: "2026-07-21",
  puzzleId: "2026-07-21",
  puzzleDate: "2026-07-21",
  imageUrl: "https://example.com/a.webp",
  mobileImageUrl: null,
  choices: [
    {choiceId: "a", title: "A"},
    {choiceId: "b", title: "B"},
    {choiceId: "c", title: "C"},
    {choiceId: "d", title: "D"},
  ],
  maxAttempts: 3,
  nextPuzzleAt: "2026-07-22T00:00:00.000Z",
  locale: "en-US",
  attempt: null,
};

test("GET /puzzles/today returns puzzle payload", async () => {
  const original = puzzleService.getToday;
  puzzleService.getToday = async () => puzzleFixture;

  try {
    const response = await request(createTestApp(), "/puzzles/today", {
      headers: {"x-episodera-player-id": "anon-player-123456"},
    });
    assert.equal(response.status, 200);
    assert.equal(response.payload.puzzleId, "2026-07-21");
  } finally {
    puzzleService.getToday = original;
  }
});

test("POST /puzzles/:id/guess validates choiceId", async () => {
  const response = await request(createTestApp(), "/puzzles/2026-07-21/guess", {
    method: "POST",
    body: {},
    headers: {"x-episodera-player-id": "anon-player-123456"},
  });
  assert.equal(response.status, 400);
  assert.equal(response.payload.error?.code, "invalid_choice");
});

test("GET /admin/puzzles/:puzzleId returns editorial puzzle detail", async () => {
  const previousAllowlist = process.env.PUZZLE_ADMIN_EMAILS;
  process.env.PUZZLE_ADMIN_EMAILS = "admin@example.com";
  const original = puzzleService.getPuzzleForAdmin;
  puzzleService.getPuzzleForAdmin = async () => ({
    puzzleId: "2026-07-22",
    puzzleDate: "2026-07-22",
    imageUrl: "https://example.com/a.webp",
    mobileImageUrl: null,
    choices: puzzleFixture.choices,
    maxAttempts: 3,
    nextPuzzleAt: "2026-07-23T00:00:00.000Z",
    locale: "en-US",
    correctChoiceId: "a",
    correctShowId: 1396,
    correctTitle: "Breaking Bad",
    hints: [{revealAfterAttempt: 1, type: "year", value: "2008"}],
    status: "published",
    difficulty: "medium",
    seasonNumber: 1,
    episodeNumber: 1,
  });

  try {
    const response = await request(createTestApp({adminEmail: "admin@example.com"}), "/admin/puzzles/2026-07-22");
    assert.equal(response.status, 200);
    assert.equal(response.payload.puzzleId, "2026-07-22");
    assert.equal(response.payload.correctTitle, "Breaking Bad");
  } finally {
    puzzleService.getPuzzleForAdmin = original;
    if (previousAllowlist === undefined) {
      delete process.env.PUZZLE_ADMIN_EMAILS;
    } else {
      process.env.PUZZLE_ADMIN_EMAILS = previousAllowlist;
    }
  }
});

test("GET /admin/puzzles/:puzzleId rejects invalid ids", async () => {
  const previousAllowlist = process.env.PUZZLE_ADMIN_EMAILS;
  process.env.PUZZLE_ADMIN_EMAILS = "admin@example.com";
  try {
    const response = await request(createTestApp({adminEmail: "admin@example.com"}), "/admin/puzzles/not-a-date");
    assert.equal(response.status, 400);
    assert.equal(response.payload.error?.code, "invalid_puzzle_id");
  } finally {
    if (previousAllowlist === undefined) {
      delete process.env.PUZZLE_ADMIN_EMAILS;
    } else {
      process.env.PUZZLE_ADMIN_EMAILS = previousAllowlist;
    }
  }
});

test("POST /admin/puzzles/ensure-today returns ensure result", async () => {
  const previousAllowlist = process.env.PUZZLE_ADMIN_EMAILS;
  process.env.PUZZLE_ADMIN_EMAILS = "admin@example.com";
  const original = autoPuzzleService.ensureTodayPuzzle;
  autoPuzzleService.ensureTodayPuzzle = async () => ({
    created: false,
    puzzleDate: "2026-07-23",
    reason: "exists",
  });

  try {
    const response = await request(createTestApp({adminEmail: "admin@example.com"}), "/admin/puzzles/ensure-today", {
      method: "POST",
      body: {},
    });
    assert.equal(response.status, 200);
    assert.equal(response.payload.created, false);
    assert.equal(response.payload.puzzleDate, "2026-07-23");
    assert.equal(response.payload.reason, "exists");
  } finally {
    autoPuzzleService.ensureTodayPuzzle = original;
    if (previousAllowlist === undefined) {
      delete process.env.PUZZLE_ADMIN_EMAILS;
    } else {
      process.env.PUZZLE_ADMIN_EMAILS = previousAllowlist;
    }
  }
});

test("GET /puzzles/admin-access reports allowlisted admins", async () => {
  const previousAllowlist = process.env.PUZZLE_ADMIN_EMAILS;
  process.env.PUZZLE_ADMIN_EMAILS = "admin@example.com";
  try {
    const adminResponse = await request(createTestApp({adminEmail: "admin@example.com"}), "/puzzles/admin-access");
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.payload.isPuzzleAdmin, true);

    const viewerResponse = await request(createTestApp({adminEmail: "viewer@example.com"}), "/puzzles/admin-access");
    assert.equal(viewerResponse.status, 200);
    assert.equal(viewerResponse.payload.isPuzzleAdmin, false);

    const anonResponse = await request(createTestApp(), "/puzzles/admin-access");
    assert.equal(anonResponse.status, 401);
  } finally {
    if (previousAllowlist === undefined) {
      delete process.env.PUZZLE_ADMIN_EMAILS;
    } else {
      process.env.PUZZLE_ADMIN_EMAILS = previousAllowlist;
    }
  }
});
