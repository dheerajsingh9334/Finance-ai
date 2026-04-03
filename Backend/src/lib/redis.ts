import { Redis } from "ioredis";
import { env } from "../config/env";

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (error) => {
  console.error("Redis Connection Error:", error);
});

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  },
  
  set: async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },
  
  del: async (key: string): Promise<void> => {
    await redis.del(key);
  },
  
  delPattern: async (pattern: string): Promise<void> => {
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  }
};

export default redis;
