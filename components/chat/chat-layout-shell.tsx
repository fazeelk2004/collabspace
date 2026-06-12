"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, KanbanSquare, Plus, MessageSquare } from "lucide-react";
import { api } from "@/lib/fetcher";
import { cn, getInitials } from "@/lib/utils";
import type { Channel, DmThread } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { useSocketEvent } from "@/hooks/use-socket";
import { usePresenceStore } from "@/store/presence-store";
import { EVENTS } from "@/server/events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NewDmDialog } from "./new-dm-dialog";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  const { workspace } = useShell();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const online = usePresenceStore((s) => s.online);
  const base = `/w/${workspace.slug}/chat`;

  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ["channels", workspace.id],
    queryFn: () => api<{ channels: Channel[] }>(`/api/workspaces/${workspace.id}/channels`),
  });

  const { data: dmsData, isLoading: dmsLoading } = useQuery({
    queryKey: ["dms", workspace.id],
    queryFn: () => api<{ threads: DmThread[] }>(`/api/workspaces/${workspace.id}/dms`),
  });

  // Any incoming message refreshes the unread counts in the lists.
  useSocketEvent(EVENTS.CHAT_MESSAGE, () => {
    queryClient.invalidateQueries({ queryKey: ["channels", workspace.id] });
    queryClient.invalidateQueries({ queryKey: ["dms", workspace.id] });
  });

  const channels = channelsData?.channels ?? [];
  const dms = dmsData?.threads ?? [];
  // A conversation is "open" — on mobile show only the conversation pane.
  const conversationOpen = pathname !== base;

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          "w-full shrink-0 overflow-y-auto border-r bg-sidebar/50 sm:w-64",
          conversationOpen && "hidden sm:block"
        )}
      >
        <div className="p-3">
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channels
          </p>
          {channelsLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            channels.map((channel) => {
              const href = `${base}/${channel.id}`;
              return (
                <Link
                  key={channel.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    pathname === href
                      ? "bg-gradient-to-r from-primary/15 to-primary/5 font-medium text-primary"
                      : "text-sidebar-foreground/80 hover:bg-accent"
                  )}
                >
                  {channel.type === "BOARD" ? (
                    <KanbanSquare className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  {channel.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-1.5 text-[10px] font-semibold text-white shadow-sm shadow-indigo-500/30">
                      {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                    </span>
                  )}
                </Link>
              );
            })
          )}

          <div className="mb-1 mt-5 flex items-center justify-between px-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Direct messages
            </p>
            <NewDmDialog>
              <button
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="New direct message"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </NewDmDialog>
          </div>
          {dmsLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : dms.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No conversations yet</p>
          ) : (
            dms.map((thread) => {
              const href = `${base}/dm/${thread.id}`;
              const isOnline = thread.other && online.has(thread.other.id);
              return (
                <Link
                  key={thread.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    pathname === href
                      ? "bg-gradient-to-r from-primary/15 to-primary/5 font-medium text-primary"
                      : "text-sidebar-foreground/80 hover:bg-accent"
                  )}
                >
                  <span className="relative shrink-0">
                    <Avatar className="h-6 w-6">
                      {thread.other?.image && <AvatarImage src={thread.other.image} alt="" />}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(thread.other?.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar",
                        isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{thread.other?.name ?? "Unknown"}</span>
                  {thread.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-1.5 text-[10px] font-semibold text-white shadow-sm shadow-indigo-500/30">
                      {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </aside>

      <div className={cn("min-w-0 flex-1", !conversationOpen && "hidden sm:block")}>
        {conversationOpen ? (
          children
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15">
              <MessageSquare className="h-7 w-7 text-indigo-400" />
            </span>
            <p className="text-sm font-medium">Pick a conversation</p>
            <p className="mt-1 text-xs">Choose a channel or start a direct message.</p>
          </div>
        )}
      </div>
    </div>
  );
}
