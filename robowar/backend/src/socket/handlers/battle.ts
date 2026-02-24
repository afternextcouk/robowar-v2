import { Server, Socket } from "socket.io";
import { AuthSocket } from "../index";
import logger from "../../config/logger";

export function registerBattleHandlers(io: Server, socket: AuthSocket) {
  socket.on("battle:join", async ({ battle_id }: { battle_id: string }) => {
    socket.join(`battle:${battle_id}`);
    logger.debug(`${socket.username} joined battle room ${battle_id}`);
    socket.emit("battle:joined", { battle_id });
  });

  socket.on("battle:leave", ({ battle_id }: { battle_id: string }) => {
    socket.leave(`battle:${battle_id}`);
  });

  socket.on("battle:ready", ({ battle_id }: { battle_id: string }) => {
    logger.debug(`${socket.username} ready for battle ${battle_id}`);
    io.to(`battle:${battle_id}`).emit("battle:player_ready", {
      user_id: socket.userId,
      username: socket.username,
    });
  });

  socket.on("battle:emote", ({
    battle_id,
    emote_id,
  }: { battle_id: string; emote_id: string }) => {
    io.to(`battle:${battle_id}`).emit("battle:emote_received", {
      from_player: socket.userId,
      emote_id,
    });
  });
}
