"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, AtSign, UserPlus, ShieldAlert, Clock } from "lucide-react";
import { api } from "@/lib/fetcher";
import { cn, getInitials } from "@/lib/utils";
import type { Notification } from "@/types";
import { useSocketEvent } from "@/hooks/use-socket";
import { EVENTS } from "@/server/events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS: Record<Notification["type"], typeof Bell> = {
  TASK_ASSIGNED: UserPlus,
  MENTIONED_COMMENT: AtSign,
  MENTIONED_CHAT: AtSign,
  INVITED: UserPlus,
  ROLE_CHANGED: ShieldAlert,
  TASK_DUE_SOON: Clock,
};

function notificationText(n: Notification): string {
  const actor = n.actor?.name ?? "Someone";
  const meta = (n.meta ?? {}) as Record<string, string>;
  switch (n.type) {
    case "TASK_ASSIGNED":
      return `${actor} assigned you to "${meta.taskTitle ?? "a task"}"`;
    case "MENTIONED_COMMENT":
      return `${actor} mentioned you in a comment on "${meta.taskTitle ?? "a task"}"`;
    case "MENTIONED_CHAT":
      return `${actor} mentioned you in #${meta.channelName ?? "chat"}`;
    case "ROLE_CHANGED":
      return `${actor} changed your role to ${meta.role?.toLowerCase() ?? "member"}`;
    case "INVITED":
      return `${actor} invited you to a workspace`;
    case "TASK_DUE_SOON":
      return `"${meta.taskTitle ?? "A task"}" is due soon`;
  }
}

export function NotificationDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });

  // Real-time: refresh the list whenever a new notification arrives.
  useSocketEvent(EVENTS.NOTIFICATION_NEW, () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  const unread = data?.unreadCount ?? 0;

  async function markRead(n: Notification) {
    if (!n.read) {
      await api(`/api/notifications/${n.id}`, { method: "PATCH", body: { read: true } });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    const meta = (n.meta ?? {}) as Record<string, string>;
    if (n.taskId && meta.boardId) {
      router.push(`/w/${n.workspace.slug}/boards/${meta.boardId}?task=${n.taskId}`);
    } else if (meta.channelId) {
      router.push(`/w/${n.workspace.slug}/chat/${meta.channelId}`);
    }
  }

  async function markAllRead() {
    await api("/api/notifications/read-all", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {(data?.notifications ?? []).length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center text-center text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">You&apos;re all caught up</p>
            </div>
          ) : (
            <div className="divide-y">
              {data?.notifications.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div className="relative mt-0.5">
                      <Avatar className="h-8 w-8">
                        {n.actor?.image && <AvatarImage src={n.actor.image} alt="" />}
                        <AvatarFallback>{getInitials(n.actor?.name ?? "?")}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-card shadow-sm">
                        <Icon className="h-2.5 w-2.5 text-primary" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{notificationText(n)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.workspace.name} ·{" "}
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
