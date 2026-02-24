import { Server } from "socket.io";
import { AuthSocket } from "../index";
import logger from "../../config/logger";

export function registerQueueHandlers(io: Server, socket: AuthSocket) {
  socket.on("queue:join", async (payload) => {
    logger.debug(`${socket.username} joining queue`, payload);
    socket.join(`queue:${payload.mode}`);
    // Actual matchmaking logic handled in MatchmakingService
    socket.emit("queue:updated", { status: "WAITING", position: null, rating_range: 50 });
  });

  socket.on("queue:leave", () => {
    logger.debug(`${socket.username} leaving queue`);
    socket.emit("queue:left", { ok: true });
  });
}
