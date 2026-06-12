import type { Server as SocketIOServer } from "socket.io";
import { EVENTS, rooms } from "../events";
import type { AuthedSocket } from "../socket";
import { refreshOnline } from "@/lib/redis/presence";
import { prisma } from "@/lib/db/prisma";

type TypingRoom =
  | { kind: "task"; id: string; boardId: string }
  | { kind: "channel"; id: string }
  | { kind: "dm"; id: string };

/**
 * Ephemeral presence signals: typing indicators, "editing task", keepalive.
 * These never touch PostgreSQL (except a throttled lastActiveAt update) —
 * they are broadcast-only and expire naturally.
 */
export function registerPresenceHandlers(_io: SocketIOServer, socket: AuthedSocket) {
  const { userId, name } = socket.data;
  let lastActiveWrite = 0;

  socket.on(EVENTS.TYPING, ({ room, isTyping }: { room: TypingRoom; isTyping: boolean }) => {
    // Only relay to rooms the socket has actually joined (join already
    // verified membership), so no extra DB check is needed here.
    const target =
      room.kind === "task"
        ? rooms.board(room.boardId)
        : room.kind === "channel"
          ? rooms.channel(room.id)
          : rooms.dm(room.id);

    if (!socket.rooms.has(target)) return;
    socket.to(target).emit(EVENTS.TYPING, {
      room,
      user: { id: userId, name },
      isTyping,
    });
  });

  socket.on(
    EVENTS.TASK_EDITING,
    ({ boardId, taskId, editing }: { boardId: string; taskId: string; editing: boolean }) => {
      const target = rooms.board(boardId);
      if (!socket.rooms.has(target)) return;
      socket.to(target).emit(EVENTS.TASK_EDITING, {
        taskId,
        user: { id: userId, name },
        editing,
      });
    }
  );

  socket.on(EVENTS.PRESENCE_PING, async () => {
    // Refresh the Redis TTL for every workspace room this socket is in.
    for (const room of socket.rooms) {
      if (room.startsWith("workspace:")) {
        await refreshOnline(room.slice("workspace:".length), userId);
      }
    }
    // Throttle lastActiveAt writes to once a minute.
    const now = Date.now();
    if (now - lastActiveWrite > 60_000) {
      lastActiveWrite = now;
      await prisma.user
        .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
        .catch(() => {});
    }
  });
}
