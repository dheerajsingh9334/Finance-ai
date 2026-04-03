import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url("Must be a valid Postgres connection URL"),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters long"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters long"),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  GEMINI_API_KEY: z.string().min(1, "Gemini API key is required"),
  GEMINI_MODEL: z.string().optional(),
  ROLE_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  AI_RATE_LIMIT_MAX: z.coerce.number().default(10),
  DASHBOARD_CACHE_TTL: z.coerce.number().default(300), // 5 minutes
  AI_QUERY_CACHE_TTL: z.coerce.number().default(300), // 5 minutes
  AI_INSIGHTS_CACHE_TTL: z.coerce.number().default(600), // 10 minutes
  AI_ANOMALIES_CACHE_TTL: z.coerce.number().default(600), // 10 minutes
  AI_QUEUE_JOB_TIMEOUT_MS: z.coerce.number().default(15000),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;
