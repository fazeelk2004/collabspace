"use client";

import { useQuery } from "@tanstack/react-query";
import { Hash, KanbanSquare } from "lucide-react";
import { api } from "@/lib/fetcher";
import type { Member, Role } from "@/types";
import { can } from "@/lib/permissions-client";
import { useShell } from "@/components/layout/app-shell";
import { Conversation } from "./conversation";

export function ChannelConversation({
  channelId,
  channelName,
  channelType,
  role,
  currentUserId,
}: {
  channelId: string;
  channelName: string;
  channelType: "WORKSPACE" | "BOARD";
  role: Role;
  currentUserId: string;
}) {
  const { workspace } = useShell();
  const { data } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${workspace.id}/members`),
  });

  return (
    <Conversation
      kind="channel"
      id={channelId}
      title={
        <span className="inline-flex items-center gap-1.5">
          {channelType === "BOARD" ? (
            <KanbanSquare className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          {channelName}
          {channelType === "BOARD" && (
            <span className="text-xs font-normal text-muted-foreground">board discussion</span>
          )}
        </span>
      }
      members={data?.members ?? []}
      currentUserId={currentUserId}
      canPost={can.contribute(role)}
      canModerate={can.manage(role)}
    />
  );
}
