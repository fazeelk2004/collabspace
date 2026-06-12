"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";
import { Pencil, Trash2, SmilePlus, Reply, CornerUpLeft } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { cn, getInitials, renderMentionsPlain } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUICK_EMOJIS = ["👍", "❤️", "😄", "🎉", "👀", "🚀"];

export function MessageItem({
  message,
  previous,
  currentUserId,
  canModerate,
  onReply,
}: {
  message: ChatMessage;
  previous?: ChatMessage;
  currentUserId: string;
  canModerate: boolean;
  onReply?: (message: ChatMessage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);

  const created = new Date(message.createdAt);
  const isOwn = message.author?.id === currentUserId;
  const showDayDivider = !previous || !isSameDay(new Date(previous.createdAt), created);
  // Group consecutive messages from the same author within 5 minutes.
  const grouped =
    !showDayDivider &&
    previous?.author?.id === message.author?.id &&
    created.getTime() - new Date(previous!.createdAt).getTime() < 5 * 60 * 1000;

  // Aggregate reactions: emoji -> userIds.
  const reactionGroups = message.reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.userId);
    return acc;
  }, {});

  async function toggleReaction(emoji: string) {
    try {
      await api(`/api/messages/${message.id}/reactions`, { method: "POST", body: { emoji } });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Reaction failed");
    }
  }

  async function saveEdit() {
    setEditing(false);
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === message.body) return;
    try {
      await api(`/api/messages/${message.id}`, { method: "PATCH", body: { body: trimmed } });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Edit failed");
    }
  }

  async function remove() {
    try {
      await api(`/api/messages/${message.id}`, { method: "DELETE" });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  return (
    <>
      {showDayDivider && (
        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {format(created, "EEEE, MMM d")}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <div className={cn("group flex gap-3 rounded-md px-1 py-0.5 hover:bg-accent/40", grouped ? "mt-0.5" : "mt-3")}>
        {grouped ? (
          <span className="w-8 shrink-0 pt-1 text-right text-[9px] leading-4 text-muted-foreground opacity-0 group-hover:opacity-100">
            {format(created, "HH:mm")}
          </span>
        ) : (
          <Avatar className="mt-0.5 h-8 w-8 shrink-0">
            {message.author?.image && <AvatarImage src={message.author.image} alt="" />}
            <AvatarFallback className="text-[10px]">
              {getInitials(message.author?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          {!grouped && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">
                {message.author?.name ?? "Deleted user"}
              </span>
              <span className="text-[10px] text-muted-foreground">{format(created, "HH:mm")}</span>
              {message.editedAt && !message.deletedAt && (
                <span className="text-[10px] text-muted-foreground">(edited)</span>
              )}
            </div>
          )}

          {/* Quoted parent for replies */}
          {message.parent && !message.deletedAt && (
            <div className="mt-0.5 flex items-start gap-1.5 rounded-md border-l-2 border-primary/50 bg-accent/40 px-2 py-1">
              <CornerUpLeft className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  {message.parent.author?.name ?? "Deleted user"}
                </span>{" "}
                {message.parent.deletedAt
                  ? "Message deleted"
                  : renderMentionsPlain(message.parent.body)}
              </p>
            </div>
          )}

          {message.deletedAt ? (
            <p className="text-sm italic text-muted-foreground">Message deleted</p>
          ) : editing ? (
            <Textarea
              autoFocus
              value={editBody}
              className="mt-1 min-h-12 text-sm"
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={saveEdit}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
              {renderMentionsPlain(message.body)}
            </p>
          )}

          {/* Reactions */}
          {Object.keys(reactionGroups).length > 0 && !message.deletedAt && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(reactionGroups).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                    userIds.includes(currentUserId)
                      ? "border-primary/40 bg-primary/10"
                      : "bg-secondary hover:bg-accent"
                  )}
                >
                  {emoji} {userIds.length}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions */}
        {!message.deletedAt && (
          <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onReply && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onReply(message)}
                aria-label="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Add reaction"
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="flex w-auto gap-1 p-1.5" align="end">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="rounded p-1 text-lg transition-transform hover:scale-125"
                    onClick={() => toggleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {isOwn && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => {
                  setEditBody(message.body);
                  setEditing(true);
                }}
                aria-label="Edit message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {(isOwn || canModerate) && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                onClick={remove}
                aria-label="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
