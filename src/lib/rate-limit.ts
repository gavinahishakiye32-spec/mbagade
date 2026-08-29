import { ApiError } from "@/lib/api";

/**
 * In-memory sliding-window rate limiter.
 * Suitable for a single node / development. For multi-instance production
 * deployments, back this interface with Redis (see README — Integration Boundaries).
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: max - bucket.hits.length, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

/** Throws ApiError TOO_MANY_REQUESTS when the limit is exceeded. */
export function enforceRateLimit(req: Request, bucketName: string, max: number, windowMs: number, extraKey?: string): void {
  const key = `${bucketName}:${extraKey ?? clientIp(req)}`;
  const result = rateLimit(key, max, windowMs);
  if (!result.allowed) {
    throw new ApiError("TOO_MANY_REQUESTS", "Too many requests. Please slow down.", 429, {
      retryAfterSec: result.retryAfterSec,
    });
  }
}
