"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, FetchError } from "@/lib/fetcher";
import { getInitials } from "@/lib/utils";
import type { Member } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewDmDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspace, user } = useShell();

  const { data } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${workspace.id}/members`),
    enabled: open,
  });
  const others = (data?.members ?? []).filter((m) => m.userId !== user.id);

  async function startDm(userId: string) {
    try {
      const { thread } = await api<{ thread: { id: string } }>(
        `/api/workspaces/${workspace.id}/dms`,
        { method: "POST", body: { userId } }
      );
      queryClient.invalidateQueries({ queryKey: ["dms", workspace.id] });
      setOpen(false);
      router.push(`/w/${workspace.slug}/chat/dm/${thread.id}`);
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not start conversation");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>Pick a teammate to message privately.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {others.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No other members in this workspace yet.
            </p>
          )}
          {others.map((m) => (
            <button
              key={m.userId}
              onClick={() => startDm(m.userId)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                <AvatarFallback>{getInitials(m.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
