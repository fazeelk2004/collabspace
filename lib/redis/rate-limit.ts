import { redis } from "./client";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
};

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 * Works across multiple containers because the counter is shared.
 */
export async function rateLimit(
  identifier: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    const ttl = count === 1 ? windowSeconds : await redis.ttl(key);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds: Math.max(0, ttl),
    };
  } catch {
    // If Redis is briefly unavailable, fail open rather than blocking all traffic.
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

export const RATE_LIMITS = {
  auth: { limit: 10, windowSeconds: 60 },      // login/register attempts per IP
  mutation: { limit: 120, windowSeconds: 60 }, // writes per user
  chat: { limit: 60, windowSeconds: 30 },      // chat messages per user
} as const;
