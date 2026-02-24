import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { robotsRouter } from "./routes/robots";
import { pilotsRouter } from "./routes/pilots";
import { algorithmsRouter } from "./routes/algorithms";
import { battlesRouter } from "./routes/battles";
import { leaderboardRouter } from "./routes/leaderboard";
import { economyRouter } from "./routes/economy";
import { adminRouter } from "./routes/admin";

export function createApp(): Application {
  const app = express();

  // ─── Security Middleware ────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  }));

  app.use(cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // ─── General Middleware ─────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  // ─── Rate Limiting ──────────────────────────────────────────
  app.use("/v2/auth", rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { code: "RATE_LIMITED", message: "Too many auth requests" },
  }));

  app.use("/v2", rateLimit({
    windowMs: 60_000,
    max: 100,
    message: { code: "RATE_LIMITED", message: "Too many requests" },
  }));

  // ─── Health Check ───────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "robowar-api", version: "2.0.0" });
  });

  // ─── API Routes (v2) ────────────────────────────────────────
  app.use("/v2/auth", authRouter);
  app.use("/v2/users", usersRouter);
  app.use("/v2/robots", robotsRouter);
  app.use("/v2/pilots", pilotsRouter);
  app.use("/v2/algorithms", algorithmsRouter);
  app.use("/v2/battles", battlesRouter);
  app.use("/v2/leaderboard", leaderboardRouter);
  app.use("/v2/economy", economyRouter);
  app.use("/v2/admin", adminRouter);

  // ─── 404 handler ────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: "Route not found" });
  });

  // ─── Global Error Handler ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
