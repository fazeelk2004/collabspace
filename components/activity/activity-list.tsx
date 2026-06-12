"use client";

import { formatDistanceToNow } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import type { Activity } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function activityText(a: Activity): string {
  const meta = (a.meta ?? {}) as Record<string, string>;
  const title = meta.title ?? a.task?.title ?? "a task";
  switch (a.type) {
    case "TASK_CREATED":
      return `created "${title}"`;
    case "TASK_UPDATED":
      return `updated "${title}"`;
    case "TASK_MOVED":
      return `moved "${title}" to ${meta.toColumn ?? "another column"}`;
    case "TASK_DELETED":
      return `deleted "${title}"`;
    case "TASK_ASSIGNED":
      return `updated assignees on "${title}"`;
    case "TASK_PRIORITY_CHANGED":
      return `set "${title}" to ${meta.priority?.toLowerCase() ?? ""} priority`;
    case "COMMENT_ADDED":
      return `commented on "${title}"`;
    case "MEMBER_INVITED":
      return `invited ${meta.email ?? "someone"} as ${meta.role?.toLowerCase() ?? "member"}`;
    case "MEMBER_JOINED":
      return `joined the workspace`;
    case "MEMBER_ROLE_CHANGED":
      return `changed ${meta.memberName ?? "a member"}'s role to ${meta.role?.toLowerCase() ?? ""}`;
    case "MEMBER_REMOVED":
      return String(meta.left) === "true"
        ? `left the workspace`
        : `removed ${meta.memberName ?? "a member"}`;
    case "BOARD_CREATED":
      return `created board "${meta.name ?? a.board?.name ?? ""}"`;
    case "BOARD_UPDATED":
      return `updated board "${meta.name ?? ""}"`;
    case "BOARD_DELETED":
      return `deleted board "${meta.name ?? ""}"`;
    case "COLUMN_CREATED":
      return `added column "${meta.name ?? ""}"`;
    case "COLUMN_DELETED":
      return `removed column "${meta.name ?? ""}"`;
    case "ATTACHMENT_ADDED":
      return `attached ${meta.fileName ?? "a file"} to "${title}"`;
    case "WORKSPACE_UPDATED":
      return `updated workspace settings`;
    default:
      return a.type.toLowerCase().replace(/_/g, " ");
  }
}

export function ActivityList({
  activities,
  compact,
}: {
  activities: Activity[];
  compact?: boolean;
}) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
    );
  }

  return (
    <ol className={cn("relative space-y-4", !compact && "ml-1")}>
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar className={cn("mt-0.5 shrink-0", compact ? "h-6 w-6" : "h-7 w-7")}>
            {a.actor?.image && <AvatarImage src={a.actor.image} alt="" />}
            <AvatarFallback className="text-[9px]">
              {getInitials(a.actor?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <span className="font-medium">{a.actor?.name ?? "Someone"}</span>{" "}
            <span className="text-foreground/80">{activityText(a)}</span>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {a.board && !compact && <span>{a.board.name} · </span>}
              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
