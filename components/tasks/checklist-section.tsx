"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function ChecklistSection({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  const { data } = useQuery({
    queryKey: ["checklist", taskId],
    queryFn: () => api<{ items: ChecklistItem[] }>(`/api/tasks/${taskId}/checklist`),
  });
  const items = data?.items ?? [];
  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["checklist", taskId] });
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  };

  async function addItem() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    try {
      await api(`/api/tasks/${taskId}/checklist`, { method: "POST", body: { text: trimmed } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not add item");
    }
  }

  async function toggle(item: ChecklistItem) {
    // Optimistic flip.
    queryClient.setQueryData(
      ["checklist", taskId],
      (old: { items: ChecklistItem[] } | undefined) =>
        old
          ? { items: old.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) }
          : old
    );
    try {
      await api(`/api/checklist/${item.id}`, { method: "PATCH", body: { done: !item.done } });
      invalidate();
    } catch (err) {
      invalidate();
      toast.error(err instanceof FetchError ? err.message : "Update failed");
    }
  }

  async function remove(item: ChecklistItem) {
    try {
      await api(`/api/checklist/${item.id}`, { method: "DELETE" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Checklist{items.length > 0 && ` · ${doneCount}/${items.length}`}
        </p>
        {canEdit && !adding && (
          <button
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" /> Add item
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              progress === 100
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : "bg-gradient-to-r from-indigo-500 to-violet-500"
            )}
          />
        </div>
      )}

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40"
            >
              <Checkbox
                checked={item.done}
                disabled={!canEdit}
                onCheckedChange={() => toggle(item)}
                aria-label={item.text}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  item.done && "text-muted-foreground line-through"
                )}
              >
                {item.text}
              </span>
              {canEdit && (
                <button
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
                  onClick={() => remove(item)}
                  aria-label="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {adding && (
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            autoFocus
            value={text}
            placeholder="Add an item…"
            className="h-8 text-sm"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Button size="sm" onClick={addItem} disabled={!text.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
