import assert from "node:assert/strict";
import http from "node:http";
import {Socket} from "node:net";
import test from "node:test";
import express, {ErrorRequestHandler} from "express";
import {AuthenticatedRequest} from "../middleware/auth";
import {HttpError} from "../lib/httpError";
import {EXPORT_SCHEMA_VERSION, UserDataExport} from "../models/export";
import {meExportRouter} from "./meExportRoutes";
import {exportService} from "../services/exportService";

const exportFixture: UserDataExport = {
  manifest: {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: "2026-07-17T00:00:00.000Z",
    userId: "route-user",
    counts: {
      history: 0,
      progressShows: 0,
      progressEpisodes: 0,
      watchlist: 0,
    },
  },
  history: [],
  progress: [],
  watchlist: [],
};

interface JsonPayload {
  error?: {
    code?: string;
    message?: string;
  };
  manifest?: {
    schemaVersion?: number;
    userId?: string;
  };
  history?: unknown[];
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
  app.use("/", meExportRouter);
  app.use(errorHandler);
  return app;
};

const request = async (app: express.Express, path: string) => {
  const req = new http.IncomingMessage(new Socket());
  req.method = "GET";
  req.url = path;
  req.headers = {};

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
    req.push(null);
  });
};

test("GET /me/export rejects missing authentication", async () => {
  const response = await request(createTestApp(false), "/me/export");

  assert.equal(response.status, 401);
  assert.equal(response.payload.error?.code, "unauthenticated");
});

test("GET /me/export returns the user data export payload", async () => {
  const originalBuild = exportService.build;
  exportService.build = (async () => exportFixture) as typeof exportService.build;

  try {
    const response = await request(createTestApp(true), "/me/export");

    assert.equal(response.status, 200);
    assert.equal(response.payload.manifest?.schemaVersion, EXPORT_SCHEMA_VERSION);
    assert.equal(response.payload.manifest?.userId, "route-user");
    assert.deepEqual(response.payload.history, []);
  } finally {
    exportService.build = originalBuild;
  }
});
