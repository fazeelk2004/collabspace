import Redis from "ioredis";

// Separate connections: pub/sub subscribers can't run normal commands,
// so the socket adapter gets its own pair while app code shares one client.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function createRedisClient(): Redis {
  const client = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 3,
    // Connect on first command, not at module load — `next build` imports
    // these modules without a Redis server available.
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
