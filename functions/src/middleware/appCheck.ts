import crypto from "node:crypto";
import {NextFunction, Response} from "express";
import {getAppCheck} from "firebase-admin/app-check";
import {
  isAppCheckEnforceAuthWrites,
  isAppCheckEnforcePublicReads,
  isSmokeBypassAppCheck,
  smokeBypassAppCheckSecret,
} from "../config/env";
import {AuthenticatedRequest} from "./auth";

const APP_CHECK_HEADER = "x-firebase-appcheck";
const SMOKE_BYPASS_HEADER = "x-episodera-smoke-bypass";

export type AppCheckStatus = "valid" | "missing" | "invalid" | "smoke_bypass";

type VerifyAppCheckToken = (token: string) => Promise<{appId: string}>;

let verifyAppCheckToken: VerifyAppCheckToken = async (token) => {
  const verified = await getAppCheck().verifyToken(token);
  return {appId: verified.appId};
};

/** Test-only hook to stub Admin App Check verification. */
export const setAppCheckTokenVerifierForTests = (verifier: VerifyAppCheckToken | null) => {
  verifyAppCheckToken = verifier ?? (async (token) => {
    const verified = await getAppCheck().verifyToken(token);
    return {appId: verified.appId};
  });
};

const secretsEqual = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const acceptsSmokeBypass = (req: AuthenticatedRequest) => {
  const expected = smokeBypassAppCheckSecret();
  if (!isSmokeBypassAppCheck() || !expected) {
    return false;
  }

  const provided = req.header(SMOKE_BYPASS_HEADER);
  if (!provided) {
    return false;
  }

  return secretsEqual(provided, expected);
};

const logAppCheck = (
  req: AuthenticatedRequest,
  status: AppCheckStatus,
  detail?: string,
) => {
  if (status === "valid" || status === "smoke_bypass") {
    return;
  }

  const payload = {
    requestId: req.requestId ?? req.header("x-request-id") ?? null,
    method: req.method,
    route: req.originalUrl,
    appCheck: status,
    ...(detail ? {detail} : {}),
  };

  if (status === "invalid") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
};

const attachSmokeBypass = (req: AuthenticatedRequest) => {
  req.appCheck = {
    appId: "smoke-bypass",
    source: "smoke_bypass",
  };
};

export const optionalAppCheck = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  if (acceptsSmokeBypass(req)) {
    attachSmokeBypass(req);
    next();
    return;
  }

  const token = req.header(APP_CHECK_HEADER)?.trim();
  if (!token) {
    // Avoid flooding logs on anonymous public reads; monitor signed-in traffic for Phase 2/3.
    if (req.header("authorization")?.startsWith("Bearer ")) {
      logAppCheck(req, "missing");
    }
    next();
    return;
  }

  try {
    const verified = await verifyAppCheckToken(token);
    req.appCheck = {
      appId: verified.appId,
      source: "token",
    };
    next();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "verify_failed";
    logAppCheck(req, "invalid", detail);
    next();
  }
};

const rejectAppCheck = (res: Response, code: "app_check_required" | "app_check_invalid") => {
  const message = code === "app_check_required"
    ? "A valid Firebase App Check token is required."
    : "Firebase App Check token is invalid.";
  res.status(401).json({error: {code, message}});
};

const enforceAppCheck = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  enforce: boolean,
) => {
  if (!enforce) {
    next();
    return;
  }

  if (req.appCheck) {
    next();
    return;
  }

  const token = req.header(APP_CHECK_HEADER)?.trim();
  rejectAppCheck(res, token ? "app_check_invalid" : "app_check_required");
};

/** Phase 3: reject when APP_CHECK_ENFORCE_AUTH_WRITES=true and App Check is missing/invalid. */
export const requireAppCheck = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  enforceAppCheck(req, res, next, isAppCheckEnforceAuthWrites());
};

/** Phase 4: reject when APP_CHECK_ENFORCE_PUBLIC_READS=true (not mounted yet). */
export const requireAppCheckPublic = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  enforceAppCheck(req, res, next, isAppCheckEnforcePublicReads());
};
