"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/fetcher";
import { getInitials } from "@/lib/utils";
import type { Member } from "@/types";
import { usePresenceStore } from "@/store/presence-store";
import { useShell } from "./app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Stacked avatars of currently-online members, animated in/out live. */
export function OnlineMembers() {
  const { workspace } = useShell();
  const online = usePresenceStore((s) => s.online);

  const { data } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${workspace.id}/members`),
  });

  const onlineMembers = (data?.members ?? []).filter((m) => online.has(m.userId)).slice(0, 5);
  if (onlineMembers.length === 0) return null;

  return (
    <div className="hidden items-center sm:flex">
      <div className="flex -space-x-2">
        <AnimatePresence>
          {onlineMembers.map((m) => (
            <motion.div
              key={m.userId}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className="h-7 w-7 border-2 border-background">
                      {m.user.image && <AvatarImage src={m.user.image} alt={m.user.name} />}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{m.user.name} · online</TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
