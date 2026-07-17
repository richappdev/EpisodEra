import assert from "node:assert/strict";
import http from "node:http";
import {Socket} from "node:net";
import test, {after, beforeEach} from "node:test";
import express from "express";
import {AuthenticatedRequest} from "./auth";
import {
  optionalAppCheck,
  requireAppCheck,
  setAppCheckTokenVerifierForTests,
} from "./appCheck";

interface JsonPayload {
  error?: {
    code?: string;
    message?: string;
  };
  ok?: boolean;
  appCheck?: {
    appId: string;
    source: string;
  } | null;
}

const envKeys = [
  "APP_CHECK_ENFORCE_AUTH_WRITES",
  "APP_CHECK_ENFORCE_PUBLIC_READS",
  "SMOKE_BYPASS_APP_CHECK",
  "SMOKE_BYPASS_APP_CHECK_SECRET",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const restoreEnv = () => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

beforeEach(() => {
  restoreEnv();
  delete process.env.APP_CHECK_ENFORCE_AUTH_WRITES;
  delete process.env.APP_CHECK_ENFORCE_PUBLIC_READS;
  delete process.env.SMOKE_BYPASS_APP_CHECK;
  delete process.env.SMOKE_BYPASS_APP_CHECK_SECRET;
  setAppCheckTokenVerifierForTests(null);
});

after(() => {
  restoreEnv();
  setAppCheckTokenVerifierForTests(null);
});

const request = async (
  app: express.Express,
  path: string,
  options: {headers?: Record<string, string>; method?: string} = {},
) => {
  const req = new http.IncomingMessage(new Socket());
  req.method = options.method ?? "GET";
  req.url = path;
  req.headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

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
    (req as AuthenticatedRequest).requestId = "test-request-id";
    if (req.header("x-test-user")) {
      (req as AuthenticatedRequest).user = {uid: req.header("x-test-user")!};
    }
    next();
  });
  app.use(optionalAppCheck);
  app.get("/public", (_req, res) => res.json({ok: true}));
  app.get("/me/profile", requireAppCheck, (req: AuthenticatedRequest, res) => {
    res.json({ok: true, appCheck: req.appCheck ?? null});
  });
  return app;
};

test("optionalAppCheck attaches a verified token without rejecting missing tokens", async () => {
  setAppCheckTokenVerifierForTests(async (token) => {
    assert.equal(token, "valid-token");
    return {appId: "1:388894496033:web:test"};
  });

  const app = createApp();
  const withToken = await request(app, "/me/profile", {
    headers: {"X-Firebase-AppCheck": "valid-token"},
  });
  const withoutToken = await request(app, "/public");

  assert.equal(withToken.status, 200);
  assert.equal(withToken.payload.appCheck?.appId, "1:388894496033:web:test");
  assert.equal(withToken.payload.appCheck?.source, "token");
  assert.equal(withoutToken.status, 200);
});

test("optionalAppCheck leaves invalid tokens unverified and does not reject in monitor mode", async () => {
  setAppCheckTokenVerifierForTests(async () => {
    throw new Error("bad token");
  });
  process.env.APP_CHECK_ENFORCE_AUTH_WRITES = "false";

  const app = createApp();
  const response = await request(app, "/me/profile", {
    headers: {"X-Firebase-AppCheck": "invalid-token"},
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.appCheck, null);
});

test("requireAppCheck rejects missing and invalid tokens when enforcement is enabled", async () => {
  setAppCheckTokenVerifierForTests(async () => {
    throw new Error("bad token");
  });
  process.env.APP_CHECK_ENFORCE_AUTH_WRITES = "true";

  const app = createApp();
  const missing = await request(app, "/me/profile", {
    headers: {Authorization: "Bearer user-token"},
  });
  const invalid = await request(app, "/me/profile", {
    headers: {
      Authorization: "Bearer user-token",
      "X-Firebase-AppCheck": "invalid-token",
    },
  });

  assert.equal(missing.status, 401);
  assert.equal(missing.payload.error?.code, "app_check_required");
  assert.equal(invalid.status, 401);
  assert.equal(invalid.payload.error?.code, "app_check_invalid");
});

test("requireAppCheck accepts a valid token when enforcement is enabled", async () => {
  setAppCheckTokenVerifierForTests(async () => ({appId: "web-app"}));
  process.env.APP_CHECK_ENFORCE_AUTH_WRITES = "true";

  const app = createApp();
  const response = await request(app, "/me/profile", {
    headers: {"X-Firebase-AppCheck": "valid-token"},
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.appCheck?.source, "token");
});

test("smoke bypass header satisfies App Check when configured", async () => {
  process.env.APP_CHECK_ENFORCE_AUTH_WRITES = "true";
  process.env.SMOKE_BYPASS_APP_CHECK = "true";
  process.env.SMOKE_BYPASS_APP_CHECK_SECRET = "smoke-secret";

  const app = createApp();
  const allowed = await request(app, "/me/profile", {
    headers: {"x-episodera-smoke-bypass": "smoke-secret"},
  });
  const denied = await request(app, "/me/profile", {
    headers: {"x-episodera-smoke-bypass": "wrong-secret"},
  });

  assert.equal(allowed.status, 200);
  assert.equal(allowed.payload.appCheck?.source, "smoke_bypass");
  assert.equal(denied.status, 401);
  assert.equal(denied.payload.error?.code, "app_check_required");
});
