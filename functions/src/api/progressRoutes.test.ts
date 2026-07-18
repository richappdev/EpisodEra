import assert from "node:assert/strict";
import http from "node:http";
import {Socket} from "node:net";
import test from "node:test";
import express, {ErrorRequestHandler} from "express";
import {AuthenticatedRequest} from "../middleware/auth";
import {HttpError} from "../lib/httpError";
import {ShowProgress} from "../models/progress";
import {progressRouter} from "./progressRoutes";
import {progressService} from "../services/progressService";

const progressFixture: ShowProgress = {
  showId: "95396",
  tmdbId: 95396,
  title: "Severance",
  poster: null,
  totalEpisodes: 3,
  watchedEpisodeCount: 1,
  progressPercent: 33.33,
  currentSeason: 1,
  currentEpisode: 1,
  nextEpisode: {
    episodeKey: "s01e02",
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: "Half Loop",
  },
  updatedAt: null,
  episodes: [],
};

interface JsonPayload {
  error?: {
    code?: string;
    message?: string;
  };
  nextEpisode?: {
    episodeKey?: string;
  };
  [key: string]: unknown;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({error: {code: error.code, message: error.message}});
    return;
  }

  res.status(500).json({error: {code: "internal", message: "Internal server error."}});
};

const createTestApp = (authenticated: boolean) => {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      (req as AuthenticatedRequest).user = {uid: "route-user"};
      next();
    });
  }
  app.use("/", progressRouter);
  app.use(errorHandler);
  return app;
};

const request = async (
  app: express.Express,
  path: string,
  options: {body?: unknown; method?: string} = {},
) => {
  const req = new http.IncomingMessage(new Socket());
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  req.method = options.method ?? "GET";
  req.url = path;
  req.headers = body === null ? {} : {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
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

test("progress routes reject missing authentication", async () => {
  const response = await request(createTestApp(false), "/progress");

  assert.equal(response.status, 401);
  assert.equal(response.payload.error?.code, "unauthenticated");
});

test("progress routes reject invalid show ids before service calls", async () => {
  const response = await request(createTestApp(true), "/progress/not-a-show");

  assert.equal(response.status, 400);
  assert.equal(response.payload.error?.code, "invalid_show_id");
});

test("single episode route rejects invalid request bodies", async () => {
  const response = await request(createTestApp(true), "/progress/95396/episode", {
    method: "POST",
    body: {seasonNumber: 1},
  });

  assert.equal(response.status, 400);
  assert.equal(response.payload.error?.code, "invalid_progress_payload");
});

test("batch route rejects oversized batches", async () => {
  const response = await request(createTestApp(true), "/progress/95396/episodes/batch", {
    method: "POST",
    body: {
      watched: true,
      episodes: Array.from({length: 101}, (_, index) => ({
        seasonNumber: 1,
        episodeNumber: index + 1,
      })),
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.payload.error?.code, "batch_too_large");
});

test("batch route passes normalized payloads to the progress service", async () => {
  const original = progressService.updateEpisodes;
  let captured: unknown = null;
  progressService.updateEpisodes = async (_userId, _showId, _tmdbId, input) => {
    captured = input;
    return progressFixture;
  };

  try {
    const response = await request(createTestApp(true), "/progress/95396/episodes/batch", {
      method: "POST",
      body: {
        watched: true,
        episodes: [
          {seasonNumber: 1, episodeNumber: 1},
          {seasonNumber: 1, episodeNumber: 1},
        ],
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(captured, {
      watched: true,
      episodes: [{seasonNumber: 1, episodeNumber: 1}],
    });
    assert.equal(response.payload.nextEpisode?.episodeKey, "s01e02");
  } finally {
    progressService.updateEpisodes = original;
  }
});

test("progress routes preserve service error status and shape", async () => {
  const original = progressService.updateEpisodes;
  progressService.updateEpisodes = async () => {
    throw new HttpError(404, "Episode was not found for this show.", "episode_not_found");
  };

  try {
    const response = await request(createTestApp(true), "/progress/95396/episodes/batch", {
      method: "POST",
      body: {
        watched: true,
        episodes: [{seasonNumber: 9, episodeNumber: 99}],
      },
    });

    assert.equal(response.status, 404);
    assert.equal(response.payload.error?.code, "episode_not_found");
  } finally {
    progressService.updateEpisodes = original;
  }
});
