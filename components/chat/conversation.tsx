"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Send, X, CornerUpLeft } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import type { ChatMessage, Member } from "@/types";
import { getSocket, useChatRoom, useSocketEvent } from "@/hooks/use-socket";
import { EVENTS } from "@/server/events";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { MessageItem } from "./message-item";

type ConversationProps = {
  kind: "channel" | "dm";
  id: string;
  title: React.ReactNode;
  members: Member[];
  currentUserId: string;
  canPost: boolean;
  canModerate: boolean;
};

export function Conversation({
  kind,
  id,
  title,
  members,
  currentUserId,
  canPost,
  canModerate,
}: ConversationProps) {
  const queryClient = useQueryClient();
  const apiBase = kind === "channel" ? `/api/channels/${id}` : `/api/dms/${id}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [readBy, setReadBy] = useState<Record<string, string>>({}); // userId -> lastReadAt
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useChatRoom(kind, id);

  const markRead = useCallback(() => {
    api(`${apiBase}/read`, { method: "POST" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    queryClient.invalidateQueries({ queryKey: ["dms"] });
  }, [apiBase, queryClient]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    api<{ messages: ChatMessage[]; nextCursor: string | null }>(`${apiBase}/messages`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
        setLoading(false);
        markRead();
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView());
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [apiBase, markRead]);

  async function loadOlder() {
    if (!nextCursor) return;
    setLoadingOlder(true);
    try {
      const data = await api<{ messages: ChatMessage[]; nextCursor: string | null }>(
        `${apiBase}/messages?cursor=${nextCursor}`
      );
      setMessages((prev) => [...data.messages, ...prev]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  // ── Real-time events ────────────────────────────────────────────────
  const matchesRoom = useCallback(
    (m: { channelId?: string | null; dmThreadId?: string | null }) =>
      kind === "channel" ? m.channelId === id : m.dmThreadId === id,
    [kind, id]
  );

  useSocketEvent<ChatMessage>(EVENTS.CHAT_MESSAGE, (message) => {
    if (!matchesRoom(message)) return;
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message]
    );
    if (message.author?.id !== currentUserId) markRead();
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  });

  useSocketEvent<ChatMessage>(EVENTS.CHAT_MESSAGE_UPDATED, (message) => {
    if (!matchesRoom(message)) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  });

  useSocketEvent<{ messageId: string; channelId: string | null; dmThreadId: string | null }>(
    EVENTS.CHAT_MESSAGE_DELETED,
    (p) => {
      if (!matchesRoom(p)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId ? { ...m, deletedAt: new Date().toISOString(), body: "" } : m
        )
      );
    }
  );

  useSocketEvent<{ messageId: string; emoji: string; userId: string; op: "add" | "remove" }>(
    EVENTS.CHAT_REACTION,
    (p) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          const reactions =
            p.op === "add"
              ? [...m.reactions, { emoji: p.emoji, userId: p.userId }]
              : m.reactions.filter((r) => !(r.emoji === p.emoji && r.userId === p.userId));
          return { ...m, reactions };
        })
      );
    }
  );

  useSocketEvent<{
    channelId?: string;
    dmThreadId?: string;
    userId: string;
    lastReadAt: string;
  }>(EVENTS.CHAT_READ, (p) => {
    if (!matchesRoom(p)) return;
    if (p.userId !== currentUserId) {
      setReadBy((prev) => ({ ...prev, [p.userId]: p.lastReadAt }));
    }
  });

  useSocketEvent<{
    room: { kind: string; id: string };
    user: { id: string; name: string };
    isTyping: boolean;
  }>(EVENTS.TYPING, (p) => {
    if (p.room.kind !== kind || p.room.id !== id) return;
    setTypingUsers((prev) => {
      const next = { ...prev };
      if (p.isTyping) next[p.user.id] = p.user.name;
      else delete next[p.user.id];
      return next;
    });
  });

  // ── Actions ─────────────────────────────────────────────────────────
  function signalTyping() {
    const socket = getSocket();
    socket.emit(EVENTS.TYPING, { room: { kind, id }, isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit(EVENTS.TYPING, { room: { kind, id }, isTyping: false });
    }, 2000);
  }

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { message } = await api<{ message: ChatMessage }>(`${apiBase}/messages`, {
        method: "POST",
        body: { body: trimmed, ...(replyTo && { parentId: replyTo.id }) },
      });
      setBody("");
      setReplyTo(null);
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Message not sent");
    } finally {
      setSending(false);
    }
  }

  // "Seen" indicator for DMs: the other participant read past our last message.
  const lastOwn = [...messages].reverse().find((m) => m.author?.id === currentUserId);
  const seen =
    kind === "dm" &&
    lastOwn &&
    Object.values(readBy).some((t) => new Date(t) >= new Date(lastOwn.createdAt));

  const typingNames = Object.entries(typingUsers)
    .filter(([uid]) => uid !== currentUserId)
    .map(([, name]) => name);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-sm font-semibold">
        {title}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {nextCursor && (
              <div className="mb-3 text-center">
                <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingOlder}>
                  Load earlier messages
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet — say hi 👋
              </p>
            )}
            <AnimatePresence initial={false}>
              {messages.map((message, i) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <MessageItem
                    message={message}
                    previous={messages[i - 1]}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    onReply={canPost ? setReplyTo : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {seen && (
              <p className="mt-1 pr-1 text-right text-[10px] text-muted-foreground">Seen</p>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 text-xs text-muted-foreground">
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5"
            >
              <span className="flex gap-0.5">
                <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground" />
              </span>
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {canPost ? (
        <div className="border-t">
          {/* Reply banner */}
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 border-b bg-accent/40 px-4 py-1.5 text-xs text-muted-foreground">
                  <CornerUpLeft className="h-3 w-3 shrink-0 text-primary" />
                  <span className="min-w-0 truncate">
                    Replying to{" "}
                    <span className="font-medium text-foreground">
                      {replyTo.author?.name ?? "Deleted user"}
                    </span>
                    : {replyTo.body}
                  </span>
                  <button
                    className="ml-auto rounded p-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => setReplyTo(null)}
                    aria-label="Cancel reply"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-end gap-2 p-3">
            <MentionTextarea
              value={body}
              onChange={(v) => {
                setBody(v);
                signalTyping();
              }}
              onSubmit={send}
              members={members}
              placeholder="Write a message… use @ to mention"
            />
            <Button size="icon" onClick={send} loading={sending} aria-label="Send message">
              <Send />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t p-3 text-center text-xs text-muted-foreground">
          Viewers can read but not post messages.
        </div>
      )}
    </div>
  );
}
