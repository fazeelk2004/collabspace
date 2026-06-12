"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, FetchError } from "@/lib/fetcher";
import type { Task } from "@/types";
import { useBoardStore } from "@/store/board-store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Quick composer at the bottom of a column — Enter creates, Esc cancels. */
export function CreateTaskInline({
  boardId,
  columnId,
  onDone,
}: {
  boardId: string;
  columnId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const addTask = useBoardStore((s) => s.addTask);

  async function create() {
    const trimmed = title.trim();
    if (!trimmed) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      const { task } = await api<{ task: Task }>(`/api/boards/${boardId}/tasks`, {
        method: "POST",
        body: { columnId, title: trimmed, priority: "MEDIUM" },
      });
      addTask(task);
      setTitle("");
      setSaving(false);
      // Stay open so several tasks can be added in a row.
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof FetchError ? err.message : "Could not create task");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-2 shadow-sm">
      <Textarea
        autoFocus
        value={title}
        placeholder="Task title… (Enter to add)"
        className="min-h-[48px] resize-none border-0 p-1 shadow-none focus-visible:ring-0"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            create();
          }
          if (e.key === "Escape") onDone();
        }}
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={create} loading={saving}>
          Add task
        </Button>
      </div>
    </div>
  );
}
