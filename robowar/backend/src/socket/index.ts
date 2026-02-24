import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "../middleware/auth";
import { registerBattleHandlers } from "./handlers/battle";
import { registerQueueHandlers } from "./handlers/queue";
import { registerSpectateHandlers } from "./handlers/spectate";
import logger from "../config/logger";

export interface AuthSocket extends Socket {
  userId: string;
  username: string;
}

let io: SocketServer;

export function createSocketServer(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 20_000,
    pingInterval: 10_000,
    transports: ["websocket", "polling"],
    path: "/v2/ws",
  });

  // ─── Auth Middleware ───────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }
    try {
      const payload = jwt.verify(
        token as string,
        process.env.JWT_SECRET || "dev_secret"
      ) as AuthPayload;
      (socket as AuthSocket).userId = payload.sub;
      (socket as AuthSocket).username = payload.username;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  // ─── Connection Handler ────────────────────────────────────
  io.on("connection", (socket) => {
    const s = socket as AuthSocket;
    logger.info(`WS connected: ${s.username} (${s.userId})`);

    // Auto-join private user room
    s.join(`user:${s.userId}`);

    // Register domain handlers
    registerBattleHandlers(io, s);
    registerQueueHandlers(io, s);
    registerSpectateHandlers(io, s);

    s.on("ping", () => s.emit("pong"));

    s.on("disconnect", (reason) => {
      logger.info(`WS disconnected: ${s.username} — ${reason}`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

// ─── Emit helpers ────────────────────────────────────────────────────────────
export const emit = {
  toUser: (userId: string, event: string, data: unknown) =>
    getIO().to(`user:${userId}`).emit(event, data),
  toBattle: (battleId: string, event: string, data: unknown) =>
    getIO().to(`battle:${battleId}`).emit(event, data),
  toLeaderboard: (event: string, data: unknown) =>
    getIO().to("leaderboard").emit(event, data),
  broadcast: (event: string, data: unknown) =>
    getIO().emit(event, data),
};
