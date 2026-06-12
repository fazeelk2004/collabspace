"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  KanbanSquare,
  Hash,
  ListTodo,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { api } from "@/lib/fetcher";
import { cn, getInitials, PRIORITY_META } from "@/lib/utils";
import type { Priority } from "@/types";
import { useShell } from "./app-shell";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SearchResults = {
  tasks: {
    id: string;
    title: string;
    priority: Priority;
    boardId: string;
    board: { name: string };
    column: { name: string };
  }[];
  boards: { id: string; name: string }[];
  channels: { id: string; name: string; type: "WORKSPACE" | "BOARD" }[];
  members: {
    userId: string;
    role: string;
    user: { name: string; image: string | null; email: string };
  }[];
};

type Item = {
  key: string;
  group: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: React.ReactNode;
};

export function CommandPalette() {
  const { workspace } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global hotkey: Ctrl/Cmd+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Allow other UI (topbar search button) to open the palette.
  useEffect(() => {
    const openPalette = () => setOpen(true);
    window.addEventListener("open-command-palette", openPalette);
    return () => window.removeEventListener("open-command-palette", openPalette);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", workspace.id, debounced],
    queryFn: () =>
      api<SearchResults>(
        `/api/workspaces/${workspace.id}/search?q=${encodeURIComponent(debounced)}`
      ),
    enabled: open && debounced.trim().length >= 2,
    placeholderData: (prev) => prev,
  });

  const base = `/w/${workspace.slug}`;
  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    return [
      ...data.tasks.map((t) => ({
        key: `task-${t.id}`,
        group: "Tasks",
        label: t.title,
        sublabel: `${t.board.name} · ${t.column.name}`,
        href: `${base}/boards/${t.boardId}?task=${t.id}`,
        icon: (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_META[t.priority].color }}
          />
        ),
      })),
      ...data.boards.map((b) => ({
        key: `board-${b.id}`,
        group: "Boards",
        label: b.name,
        href: `${base}/boards/${b.id}`,
        icon: <KanbanSquare className="h-4 w-4 text-indigo-400" />,
      })),
      ...data.channels.map((c) => ({
        key: `channel-${c.id}`,
        group: "Channels",
        label: c.name,
        href: `${base}/chat/${c.id}`,
        icon: <Hash className="h-4 w-4 text-sky-400" />,
      })),
      ...data.members.map((m) => ({
        key: `member-${m.userId}`,
        group: "Members",
        label: m.user.name,
        sublabel: m.user.email,
        href: `${base}/members`,
        icon: (
          <Avatar className="h-5 w-5">
            {m.user.image && <AvatarImage src={m.user.image} alt="" />}
            <AvatarFallback className="text-[9px]">{getInitials(m.user.name)}</AvatarFallback>
          </Avatar>
        ),
      })),
    ];
  }, [data, base]);

  useEffect(() => setActiveIndex(0), [items.length, debounced]);

  const select = useCallback(
    (item: Item) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[activeIndex]) {
      e.preventDefault();
      select(items[activeIndex]);
    }
  }

  // Keep the active row visible while arrowing.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search workspace</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4">
          {isFetching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, boards, channels, people…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {debounced.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type at least two characters to search {workspace.name}.
            </p>
          ) : items.length === 0 && !isFetching ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for “{debounced}”
            </p>
          ) : (
            items.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.key}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.group}
                    </p>
                  )}
                  <motion.button
                    data-index={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.2) }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                      i === activeIndex ? "bg-accent" : "hover:bg-accent/60"
                    )}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(item)}
                  >
                    <span className="flex w-5 shrink-0 items-center justify-center">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                    {i === activeIndex && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </motion.button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t px-4 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↑↓</kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↵</kbd> open
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <ListTodo className="h-3 w-3" /> {workspace.name}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
