"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { UserPlus, MoreHorizontal, Copy, X } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { cn, getInitials } from "@/lib/utils";
import { can } from "@/lib/permissions-client";
import type { Member, Invitation, Role } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { usePresenceStore } from "@/store/presence-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteMemberDialog } from "./invite-member-dialog";

const ROLE_BADGE: Record<Role, string> = {
  OWNER: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  ADMIN: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  MEMBER: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  VIEWER: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export function MembersView() {
  const { workspace, role: myRole, user } = useShell();
  const queryClient = useQueryClient();
  const online = usePresenceStore((s) => s.online);
  const isManager = can.manage(myRole);

  const { data, isLoading } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${workspace.id}/members`),
  });

  const { data: invitesData } = useQuery({
    queryKey: ["invitations", workspace.id],
    queryFn: () =>
      api<{ invitations: Invitation[] }>(`/api/workspaces/${workspace.id}/invitations`),
    enabled: isManager,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["members", workspace.id] });
    queryClient.invalidateQueries({ queryKey: ["invitations", workspace.id] });
  };

  async function changeRole(member: Member, role: Role) {
    try {
      await api(`/api/workspaces/${workspace.id}/members/${member.id}`, {
        method: "PATCH",
        body: { role },
      });
      toast.success(`${member.user.name} is now ${role.toLowerCase()}`);
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Role change failed");
    }
  }

  async function removeMember(member: Member) {
    const isSelf = member.userId === user.id;
    if (!confirm(isSelf ? "Leave this workspace?" : `Remove ${member.user.name}?`)) return;
    try {
      await api(`/api/workspaces/${workspace.id}/members/${member.id}`, { method: "DELETE" });
      if (isSelf) {
        window.location.href = "/dashboard";
        return;
      }
      toast.success("Member removed");
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Remove failed");
    }
  }

  async function cancelInvite(invitation: Invitation) {
    try {
      await api(`/api/workspaces/${workspace.id}/invitations/${invitation.id}`, {
        method: "DELETE",
      });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not cancel invitation");
    }
  }

  function copyInviteLink(invitation: Invitation) {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${invitation.token}`);
    toast.success("Invite link copied");
  }

  const members = data?.members ?? [];
  const invitations = invitesData?.invitations ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">Members</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} in {workspace.name}
          </p>
        </div>
        {isManager && (
          <InviteMemberDialog onInvited={invalidate}>
            <Button className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/35">
              <UserPlus /> Invite
            </Button>
          </InviteMemberDialog>
        )}
      </div>

      {/* Member list */}
      <div className="divide-y rounded-2xl border bg-card shadow-sm dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03]">
        {isLoading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))
          : members.map((member, i) => {
              const isOnline = online.has(member.userId);
              const isSelf = member.userId === user.id;
              const canManageThis =
                isManager &&
                !isSelf &&
                (myRole === "OWNER" || !can.manage(member.role));
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-4"
                >
                  <span className="relative">
                    <Avatar className="h-9 w-9">
                      {member.user.image && <AvatarImage src={member.user.image} alt="" />}
                      <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                        isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user.name}
                      {isSelf && <span className="text-muted-foreground"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email} ·{" "}
                      {isOnline
                        ? "online now"
                        : `active ${formatDistanceToNow(new Date(member.user.lastActiveAt), { addSuffix: true })}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", ROLE_BADGE[member.role])}>
                    {member.role.toLowerCase()}
                  </Badge>
                  {(canManageThis || isSelf) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="iconSm" aria-label="Member options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManageThis && (
                          <>
                            <DropdownMenuLabel>Change role</DropdownMenuLabel>
                            {(["ADMIN", "MEMBER", "VIEWER"] as const).map((r) => (
                              <DropdownMenuItem
                                key={r}
                                disabled={member.role === r}
                                onClick={() => changeRole(member, r)}
                                className="capitalize"
                              >
                                {r.toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                            {myRole === "OWNER" && (
                              <DropdownMenuItem
                                disabled={member.role === "OWNER"}
                                onClick={() => changeRole(member, "OWNER")}
                              >
                                Owner
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => removeMember(member)}
                        >
                          {isSelf ? "Leave workspace" : "Remove member"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </motion.div>
              );
            })}
      </div>

      {/* Pending invitations */}
      {isManager && invitations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Pending invitations
          </h3>
          <div className="divide-y rounded-2xl border bg-card shadow-sm dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03]">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-4">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{inv.email[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {inv.role.toLowerCase()} by {inv.invitedBy?.name ?? "someone"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyInviteLink(inv)}>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => cancelInvite(inv)}
                  aria-label="Cancel invitation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
