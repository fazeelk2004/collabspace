"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { EVENTS } from "@/server/events";

// Module-level singleton: one socket connection per browser tab.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      withCredentials: true,
      autoConnect: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    // Keep presence alive while the tab is open.
    setInterval(() => {
      if (socket?.connected) socket.emit(EVENTS.PRESENCE_PING);
    }, 30_000);
  }
  return socket;
}

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    const listener = (payload: T) => handlerRef.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}

/** Join a workspace room (and leave on unmount). */
export function useWorkspaceRoom(workspaceId: string | undefined) {
  useEffect(() => {
    if (!workspaceId) return;
    const s = getSocket();
    const join = () => s.emit(EVENTS.WORKSPACE_JOIN, { workspaceId });
    join();
    s.on("connect", join); // rejoin after reconnects
    return () => {
      s.off("connect", join);
      s.emit(EVENTS.WORKSPACE_LEAVE, { workspaceId });
    };
  }, [workspaceId]);
}

/** Join a board room (and leave on unmount). */
export function useBoardRoom(boardId: string | undefined) {
  useEffect(() => {
    if (!boardId) return;
    const s = getSocket();
    const join = () => s.emit(EVENTS.BOARD_JOIN, { boardId });
    join();
    s.on("connect", join);
    return () => {
      s.off("connect", join);
      s.emit(EVENTS.BOARD_LEAVE, { boardId });
    };
  }, [boardId]);
}

/** Join a chat room: channel or DM thread. */
export function useChatRoom(kind: "channel" | "dm", id: string | undefined) {
  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    const joinEvent = kind === "channel" ? EVENTS.CHANNEL_JOIN : EVENTS.DM_JOIN;
    const payload = kind === "channel" ? { channelId: id } : { threadId: id };
    const join = () => s.emit(joinEvent, payload);
    join();
    s.on("connect", join);
    return () => {
      s.off("connect", join);
      if (kind === "channel") s.emit(EVENTS.CHANNEL_LEAVE, { channelId: id });
    };
  }, [kind, id]);
}
