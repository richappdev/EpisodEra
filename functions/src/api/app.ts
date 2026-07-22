import cors from "cors";
import express, {ErrorRequestHandler} from "express";
import crypto from "node:crypto";
import {authenticatedWriteRateLimit, corsOrigins, publicReadRateLimit} from "../config/env";
import {HttpError} from "../lib/httpError";
import {optionalAppCheck} from "../middleware/appCheck";
import {AuthenticatedRequest, optionalAuth} from "../middleware/auth";
import {
  authenticatedWriteRateLimitKey,
  publicReadRateLimitKey,
  rateLimit,
} from "../middleware/rateLimit";
import {mediaRouter} from "./mediaRoutes";
import {meExportRouter} from "./meExportRoutes";
import {meRouter} from "./meRoutes";
import {discoveryRouter} from "./discoveryRoutes";
import {progressRouter} from "./progressRoutes";
import {watchlistRouter} from "./watchlistRoutes";
import {puzzleRouter} from "./puzzleRoutes";

export const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new HttpError(403, "Origin is not allowed.", "origin_not_allowed"));
  },
}));
app.use(express.json({limit: "256kb"}));
app.use((req, res, next) => {
  const requestId = req.header("x-request-id") ?? crypto.randomUUID();
  const startedAt = Date.now();
  (req as AuthenticatedRequest).requestId = requestId;

  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    console.info(JSON.stringify({
      requestId,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});
app.use(optionalAuth);
app.use(optionalAppCheck);
app.use(rateLimit({
  key: publicReadRateLimitKey,
  maxRequests: publicReadRateLimit.maxRequests,
  windowMs: publicReadRateLimit.windowMs,
}));
app.use(rateLimit({
  key: authenticatedWriteRateLimitKey,
  maxRequests: authenticatedWriteRateLimit.maxRequests,
  windowMs: authenticatedWriteRateLimit.windowMs,
}));

app.get("/health", (_req, res) => {
  res.json({ok: true});
});

app.use("/", mediaRouter);
app.use("/", discoveryRouter);
app.use("/", watchlistRouter);
app.use("/", progressRouter);
app.use("/", meExportRouter);
app.use("/", meRouter);
app.use("/", puzzleRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({error: {code: error.code, message: error.message}});
    return;
  }

  console.error("Unhandled API error", error);
  res.status(500).json({error: {code: "internal", message: "Internal server error."}});
};

app.use(errorHandler);
