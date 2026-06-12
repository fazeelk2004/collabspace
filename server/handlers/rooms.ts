import type { Server as SocketIOServer } from "socket.io";
import { EVENTS, rooms } from "../events";
import type { AuthedSocket } from "../socket";
import {
  requireMembership,
  requireBoardAccess,
  requireChannelAccess,
  requireDmAccess,
} from "@/lib/permissions";
import {
  markOnline,
  markOffline,
  getOnlineUserIds,
  addBoardViewer,
  removeBoardViewer,
  getBoardViewers,
  addTaskViewer,
  removeTaskViewer,
  getTaskViewers,
} from "@/lib/redis/presence";

/**
 * Room membership handlers. Every join re-validates membership against
 * PostgreSQL — rooms are the tenant-isolation boundary for real-time data.
 */
export function registerRoomHandlers(io: SocketIOServer, socket: AuthedSocket) {
  const { userId } = socket.data;

  socket.on(EVENTS.WORKSPACE_JOIN, async ({ workspaceId }: { workspaceId: string }) => {
    try {
      await requireMembership(userId, workspaceId);
      await socket.join(rooms.workspace(workspaceId));
      await markOnline(workspaceId, userId);

      socket.emit(EVENTS.PRESENCE_STATE, {
        workspaceId,
        online: await getOnlineUserIds(workspaceId),
      });
      socket.to(rooms.workspace(workspaceId)).emit(EVENTS.PRESENCE_ONLINE, { userId });
    } catch {
      socket.emit("error", { message: "Cannot join workspace" });
    }
  });

  socket.on(EVENTS.WORKSPACE_LEAVE, async ({ workspaceId }: { workspaceId: string }) => {
    await socket.leave(rooms.workspace(workspaceId));
    await markOffline(workspaceId, userId);
    socket.to(rooms.workspace(workspaceId)).emit(EVENTS.PRESENCE_OFFLINE, { userId });
  });

  socket.on(EVENTS.BOARD_JOIN, async ({ boardId }: { boardId: string }) => {
    try {
      await requireBoardAccess(userId, boardId);
      await socket.join(rooms.board(boardId));
      await addBoardViewer(boardId, userId);
      io.to(rooms.board(boardId)).emit(EVENTS.BOARD_VIEWERS, {
        boardId,
        viewers: await getBoardViewers(boardId),
      });
    } catch {
      socket.emit("error", { message: "Cannot join board" });
    }
  });

  socket.on(EVENTS.BOARD_LEAVE, async ({ boardId }: { boardId: string }) => {
    await socket.leave(rooms.board(boardId));
    await removeBoardViewer(boardId, userId);
    io.to(rooms.board(boardId)).emit(EVENTS.BOARD_VIEWERS, {
      boardId,
      viewers: await getBoardViewers(boardId),
    });
  });

  // Task-level viewer presence. The board room is the broadcast scope;
  // BOARD_JOIN already verified access, so we only relay within that room.
  socket.on(EVENTS.TASK_VIEW_JOIN, async ({ boardId, taskId }: { boardId: string; taskId: string }) => {
    const room = rooms.board(boardId);
    if (!socket.rooms.has(room)) return;
    await addTaskViewer(taskId, userId);
    socket.data.viewingTask = { taskId, boardId };
    io.to(room).emit(EVENTS.TASK_VIEWERS, { taskId, viewers: await getTaskViewers(taskId) });
  });

  socket.on(EVENTS.TASK_VIEW_LEAVE, async ({ boardId, taskId }: { boardId: string; taskId: string }) => {
    await removeTaskViewer(taskId, userId);
    socket.data.viewingTask = undefined;
    io.to(rooms.board(boardId)).emit(EVENTS.TASK_VIEWERS, {
      taskId,
      viewers: await getTaskViewers(taskId),
    });
  });

  socket.on(EVENTS.CHANNEL_JOIN, async ({ channelId }: { channelId: string }) => {
    try {
      await requireChannelAccess(userId, channelId);
      await socket.join(rooms.channel(channelId));
    } catch {
      socket.emit("error", { message: "Cannot join channel" });
    }
  });

  socket.on(EVENTS.CHANNEL_LEAVE, async ({ channelId }: { channelId: string }) => {
    await socket.leave(rooms.channel(channelId));
  });

  socket.on(EVENTS.DM_JOIN, async ({ threadId }: { threadId: string }) => {
    try {
      await requireDmAccess(userId, threadId);
      await socket.join(rooms.dm(threadId));
    } catch {
      socket.emit("error", { message: "Cannot join conversation" });
    }
  });

  // On disconnect, clean up viewer sets for any board rooms this socket was in.
  socket.on("disconnecting", async () => {
    const viewing = socket.data.viewingTask;
    if (viewing) {
      await removeTaskViewer(viewing.taskId, userId);
      socket.to(rooms.board(viewing.boardId)).emit(EVENTS.TASK_VIEWERS, {
        taskId: viewing.taskId,
        viewers: await getTaskViewers(viewing.taskId),
      });
    }
    for (const room of socket.rooms) {
      if (room.startsWith("board:")) {
        const boardId = room.slice("board:".length);
        await removeBoardViewer(boardId, userId);
        socket.to(room).emit(EVENTS.BOARD_VIEWERS, {
          boardId,
          viewers: await getBoardViewers(boardId),
        });
      }
      if (room.startsWith("workspace:")) {
        const workspaceId = room.slice("workspace:".length);
        await markOffline(workspaceId, userId);
        socket.to(room).emit(EVENTS.PRESENCE_OFFLINE, { userId });
      }
    }
  });
}
