import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import { createSocketServer } from "./socket";
import { connectDB } from "./db";
import { connectRedis } from "./config/redis";
import logger from "./config/logger";

const PORT = parseInt(process.env.PORT || "4000", 10);

async function bootstrap() {
  try {
    // ─── YPY-48: Hard-fail if JWT secrets are missing ─────────────────────
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) throw new Error("JWT_SECRET env var is required — server refuses to start without it");

    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    if (!JWT_REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET env var is required — server refuses to start without it");
    // ──────────────────────────────────────────────────────────────────────

    // Connect to database
    await connectDB();
    logger.info("✅ PostgreSQL connected");

    // Connect to Redis
    await connectRedis();
    logger.info("✅ Redis connected");

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Attach Socket.IO
    createSocketServer(server);
    logger.info("✅ Socket.IO initialized");

    server.listen(PORT, () => {
      logger.info(`🚀 ROBOWAR API running on port ${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    logger.error("Failed to bootstrap server:", err);
    process.exit(1);
  }
}

bootstrap();
