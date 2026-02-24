import { Redis } from "ioredis";
import logger from "./logger";

let client: Redis;

export function connectRedis(): Promise<void> {
  client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    logger.error("Redis error:", err.message);
  });

  client.on("connect", () => logger.info("Redis connecting..."));
  client.on("ready", () => logger.info("Redis ready"));

  return client.connect();
}

export function getRedis(): Redis {
  if (!client) throw new Error("Redis not initialized");
  return client;
}

// ─── Helper utilities ───────────────────────────────────────────────────────
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await getRedis().get(key);
    return val ? (JSON.parse(val) as T) : null;
  },
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const str = JSON.stringify(value);
    if (ttlSeconds) {
      await getRedis().setex(key, ttlSeconds, str);
    } else {
      await getRedis().set(key, str);
    }
  },
  async del(key: string): Promise<void> {
    await getRedis().del(key);
  },
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await getRedis().keys(pattern);
    if (keys.length) await getRedis().del(...keys);
  },
};

// ─── Cache key helpers ───────────────────────────────────────────────────────
export const CK = {
  user: (id: string) => `user:${id}`,
  robots: () => `robots:all`,
  robot: (id: string) => `robot:${id}`,
  leaderboard: (offset: number) => `leaderboard:${offset}`,
  algorithm: (id: string) => `algo:${id}`,
  battle: (id: string) => `battle:${id}`,
  battleRoom: (id: string) => `battle_room:${id}`,
  queue: (mode: string) => `queue:${mode}`,
  rates: () => `economy:rates`,
};
