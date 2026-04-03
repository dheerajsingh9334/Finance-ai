import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../lib/redis";
import { env } from "../config/env";

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: { success: false, error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as any,
  }),
});

export { globalLimiter };
