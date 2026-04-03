import { env } from "./config/env";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { globalLimiter } from "./middleware/rateLimiter.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { AppError } from "./lib/errors";
import redis from "./lib/redis";

import { authRouter } from "./modules/auth/auth.router";
import { usersRouter } from "./modules/users/users.router";
import { recordsRouter } from "./modules/records/records.router";
import { dashboardRouter } from "./modules/dashboard/dashboard.router";
import { aiRouter } from "./modules/ai/ai.router";

const app = express();

// Needed for accurate client IP handling behind hosting proxies (e.g., Render).
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(globalLimiter);

app.get("/api/health", async (req, res) => {
  let redisStatus = "disconnected";
  try {
    const ping = await redis.ping();
    if (ping) redisStatus = "connected";
  } catch (err) {
    redisStatus = "disconnected";
  }

  const timestamp = new Date().toISOString();
  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Health Check</title>
    <style>
      .card {
        padding: 1.5rem 2rem;
        border-radius: 0.75rem;
        background: rgba(238, 238, 238, 0.23);
        text-align: center;
        color:rgb(1, 238, 179);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>API Healthy</h1>
      <p>Status: ok</p>
      <p>Redis: ${redisStatus}</p>
      <p>Time: ${timestamp}</p>
    </div>
  </body>
</html>`);
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/records", recordsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/ai", aiRouter);

app.use((req, res, next) => {
  next(new AppError("Route not found", 404));
});

app.use(errorHandler);

const PORT = env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
});

export default app;
