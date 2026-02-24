import { Server } from "socket.io";
import { AuthSocket } from "../index";

export function registerSpectateHandlers(io: Server, socket: AuthSocket) {
  socket.on("spectate:join", ({ battle_id }: { battle_id: string }) => {
    socket.join(`battle:${battle_id}`);
    socket.join("leaderboard");
    io.to(`battle:${battle_id}`).emit("spectate:joined", {
      user_id: socket.userId,
      username: socket.username,
    });
  });

  socket.on("spectate:leave", ({ battle_id }: { battle_id: string }) => {
    socket.leave(`battle:${battle_id}`);
  });
}
