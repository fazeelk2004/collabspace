"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Send, Trash2, Pencil } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { getInitials, renderMentionsPlain } from "@/lib/utils";
import type { Comment, Member } from "@/types";
import { getSocket, useSocketEvent } from "@/hooks/use-socket";
import { EVENTS } from "@/server/events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextarea } from "./mention-textarea";

export function CommentsSection({
  taskId,
  boardId,
  members,
  canComment,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  boardId: string;
  members: Member[];
  canComment: boolean;
  currentUserId: string;
  canModerate: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => api<{ comments: Comment[] }>(`/api/tasks/${taskId}/comments`),
  });
  const comments = data?.comments ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["comments", taskId] });

  // Real-time updates from other users.
  useSocketEvent<Comment & { taskId: string }>(EVENTS.COMMENT_ADDED, (c) => {
    if (c.taskId === taskId) invalidate();
  });
  useSocketEvent<Comment & { taskId: string }>(EVENTS.COMMENT_UPDATED, (c) => {
    if (c.taskId === taskId) invalidate();
  });
  useSocketEvent<{ taskId: string }>(EVENTS.COMMENT_DELETED, (p) => {
    if (p.taskId === taskId) invalidate();
  });
  useSocketEvent<{
    room: { kind: string; id: string };
    user: { id: string; name: string };
    isTyping: boolean;
  }>(EVENTS.TYPING, (p) => {
    if (p.room.kind !== "task" || p.room.id !== taskId) return;
    setTypingUsers((prev) => {
      const next = { ...prev };
      if (p.isTyping) next[p.user.id] = p.user.name;
      else delete next[p.user.id];
      return next;
    });
  });

  function signalTyping() {
    const socket = getSocket();
    socket.emit(EVENTS.TYPING, { room: { kind: "task", id: taskId, boardId }, isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit(EVENTS.TYPING, { room: { kind: "task", id: taskId, boardId }, isTyping: false });
    }, 2000);
  }
  useEffect(() => () => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  }, []);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await api(`/api/tasks/${taskId}/comments`, { method: "POST", body: { body: trimmed } });
      setBody("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not post comment");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(commentId: string) {
    const trimmed = editBody.trim();
    setEditingId(null);
    if (!trimmed) return;
    try {
      await api(`/api/comments/${commentId}`, { method: "PATCH", body: { body: trimmed } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Edit failed");
    }
  }

  async function remove(commentId: string) {
    try {
      await api(`/api/comments/${commentId}`, { method: "DELETE" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  const typingNames = Object.entries(typingUsers)
    .filter(([id]) => id !== currentUserId)
    .map(([, name]) => name);

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {comments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="group flex gap-3"
          >
            <Avatar className="mt-0.5 h-7 w-7">
              {comment.author?.image && <AvatarImage src={comment.author.image} alt="" />}
              <AvatarFallback className="text-[10px]">
                {getInitials(comment.author?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{comment.author?.name ?? "Deleted user"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  {comment.editedAt && " · edited"}
                </span>
                <span className="ml-auto hidden gap-1 group-hover:flex">
                  {comment.author?.id === currentUserId && (
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditBody(comment.body);
                      }}
                      aria-label="Edit comment"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {(comment.author?.id === currentUserId || canModerate) && (
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => remove(comment.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </div>
              {editingId === comment.id ? (
                <Textarea
                  autoFocus
                  value={editBody}
                  className="mt-1 min-h-16 text-sm"
                  onChange={(e) => setEditBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveEdit(comment.id);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => saveEdit(comment.id)}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {renderMentionsPlain(comment.body)}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {comments.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No comments yet — start the discussion.
        </p>
      )}

      {/* Typing indicator */}
      <AnimatePresence>
        {typingNames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="flex gap-0.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </span>
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </motion.div>
        )}
      </AnimatePresence>

      {canComment && (
        <div className="flex items-end gap-2">
          <MentionTextarea
            value={body}
            onChange={(v) => {
              setBody(v);
              signalTyping();
            }}
            onSubmit={send}
            members={members}
            placeholder="Write a comment… use @ to mention"
          />
          <Button size="icon" onClick={send} loading={sending} aria-label="Send comment">
            <Send />
          </Button>
        </div>
      )}
    </div>
  );
}
