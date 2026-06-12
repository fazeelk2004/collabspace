"use client";

import { useWorkspaceRoom, useSocketEvent } from "@/hooks/use-socket";
import { usePresenceStore } from "@/store/presence-store";
import { EVENTS } from "@/server/events";

/** Invisible component: joins the workspace room and feeds the presence store. */
export function PresenceListener({ workspaceId }: { workspaceId: string }) {
  useWorkspaceRoom(workspaceId);

  const { setOnline, markOnline, markOffline } = usePresenceStore();

  useSocketEvent<{ workspaceId: string; online: string[] }>(EVENTS.PRESENCE_STATE, (p) => {
    if (p.workspaceId === workspaceId) setOnline(p.online);
  });
  useSocketEvent<{ userId: string }>(EVENTS.PRESENCE_ONLINE, (p) => markOnline(p.userId));
  useSocketEvent<{ userId: string }>(EVENTS.PRESENCE_OFFLINE, (p) => markOffline(p.userId));

  return null;
}
