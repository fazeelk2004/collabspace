import type { Server as SocketIOServer } from "socket.io";
import { rooms, type EventName } from "./events";

/**
 * Bridge between API route handlers and the Socket.io server.
 *
 * The custom server (server/index.ts) stores the io instance on globalThis;
 * Next.js bundles route handlers into separate module graphs, so a plain
 * module-level variable would not be shared — globalThis is, because
 * everything runs in the same process.
 */
const IO_KEY = "__collabspace_io__" as const;

type GlobalWithIo = typeof globalThis & { [IO_KEY]?: SocketIOServer };

export function setIo(io: SocketIOServer): void {
  (globalThis as GlobalWithIo)[IO_KEY] = io;
}

export function getIo(): SocketIOServer | null {
  return (globalThis as GlobalWithIo)[IO_KEY] ?? null;
}

function emit(room: string, event: EventName, payload: unknown): void {
  const io = getIo();
  if (!io) return; // e.g. during `next build` page data collection
  io.to(room).emit(event, payload);
}

export const emitToUser = (userId: string, event: EventName, payload: unknown) =>
  emit(rooms.user(userId), event, payload);

export const emitToWorkspace = (workspaceId: string, event: EventName, payload: unknown) =>
  emit(rooms.workspace(workspaceId), event, payload);

export const emitToBoard = (boardId: string, event: EventName, payload: unknown) =>
  emit(rooms.board(boardId), event, payload);

export const emitToChannel = (channelId: string, event: EventName, payload: unknown) =>
  emit(rooms.channel(channelId), event, payload);

export const emitToDm = (threadId: string, event: EventName, payload: unknown) =>
  emit(rooms.dm(threadId), event, payload);
