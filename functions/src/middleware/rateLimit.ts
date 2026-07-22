import {NextFunction, Response} from "express";
import {AuthenticatedRequest} from "./auth";

interface RateLimitOptions {
  key: (req: AuthenticatedRequest) => string | null;
  maxRequests: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const rateLimitedMethods = new Set(["POST", "PATCH", "DELETE"]);
const publicReadPaths = [
  /^\/search(?:\?|$)/,
  /^\/trending(?:\/|$|\?)/,
  /^\/movie\/\d+(?:\?|$)/,
  /^\/tv\/\d+(?:\/season\/\d+)?(?:\?|$)/,
  /^\/franchises(?:\/|$|\?)/,
  /^\/discover(?:\/|$|\?)/,
  /^\/discussions(?:\/|$|\?)/,
];

const writePaths = [
  /^\/watchlist(?:\/|$)/,
  /^\/likes(?:\/|$)/,
  /^\/progress(?:\/|$)/,
  /^\/me\/profile(?:\?|$)/,
  /^\/me\/settings(?:\?|$)/,
  /^\/me\/account(?:\?|$)/,
  /^\/me\/friends(?:\/|$)/,
  /^\/discussions(?:\/|$)/,
];

export const resetRateLimitBucketsForTests = () => {
  buckets.clear();
};

export const clientIpFor = (req: AuthenticatedRequest) => {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
};

export const rateLimit = ({key, maxRequests, windowMs}: RateLimitOptions) => (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const bucketKey = key(req);

  if (!bucketKey) {
    next();
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(bucketKey);
  const activeBucket = bucket && bucket.resetAt > now ? bucket : {count: 0, resetAt: now + windowMs};

  activeBucket.count += 1;
  buckets.set(bucketKey, activeBucket);

  const remaining = Math.max(maxRequests - activeBucket.count, 0);
  res.setHeader("x-ratelimit-limit", String(maxRequests));
  res.setHeader("x-ratelimit-remaining", String(remaining));
  res.setHeader("x-ratelimit-reset", String(Math.ceil(activeBucket.resetAt / 1000)));

  if (activeBucket.count > maxRequests) {
    res.status(429).json({
      error: {
        code: "rate_limited",
        message: "Too many requests. Please retry later.",
      },
    });
    return;
  }

  next();
};

export const publicReadRateLimitKey = (req: AuthenticatedRequest) => {
  if (req.method !== "GET" || !publicReadPaths.some((pattern) => pattern.test(req.originalUrl))) {
    return null;
  }

  return `public:${clientIpFor(req)}`;
};

export const authenticatedWriteRateLimitKey = (req: AuthenticatedRequest) => {
  if (!rateLimitedMethods.has(req.method) || !writePaths.some((pattern) => pattern.test(req.originalUrl))) {
    return null;
  }

  return `write:${req.user?.uid ?? clientIpFor(req)}`;
};
