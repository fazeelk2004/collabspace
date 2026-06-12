"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetcher";
import { cn, getInitials } from "@/lib/utils";
import type { Member, UserLite } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { usePresenceStore } from "@/store/presence-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Conversation } from "./conversation";

export function DmConversation({
  threadId,
  other,
  currentUserId,
}: {
  threadId: string;
  other: UserLite | null;
  currentUserId: string;
}) {
  const { workspace } = useShell();
  const online = usePresenceStore((s) => s.online);
  const isOnline = other && online.has(other.id);

  const { data } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${workspace.id}/members`),
  });

  return (
    <Conversation
      kind="dm"
      id={threadId}
      title={
        <span className="inline-flex items-center gap-2">
          <span className="relative">
            <Avatar className="h-6 w-6">
              {other?.image && <AvatarImage src={other.image} alt="" />}
              <AvatarFallback className="text-[9px]">
                {getInitials(other?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
                isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
              )}
            />
          </span>
          {other?.name ?? "Unknown user"}
          <span className="text-xs font-normal text-muted-foreground">
            {isOnline ? "online" : "offline"}
          </span>
        </span>
      }
      members={data?.members ?? []}
      currentUserId={currentUserId}
      canPost
      canModerate={false}
    />
  );
}
