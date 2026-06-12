"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, FetchError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions-client";
import type { Column, Role } from "@/types";
import type { BoardFilters } from "./board-view";
import { useBoardStore } from "@/store/board-store";
import { SortableTaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BoardColumn({
  column,
  role,
  filters,
  onOpenTask,
}: {
  column: Column;
  role: Role;
  filters: BoardFilters;
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { updateColumn, removeColumn } = useBoardStore();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [composing, setComposing] = useState(false);

  const tasks = useMemo(() => {
    const q = filters.search.toLowerCase();
    return column.tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (filters.priority !== "ALL" && t.priority !== filters.priority) return false;
      if (
        filters.assigneeId !== "ALL" &&
        !t.assignees.some((a) => a.user.id === filters.assigneeId)
      )
        return false;
      return true;
    });
  }, [column.tasks, filters]);

  async function rename() {
    setRenaming(false);
    const next = name.trim();
    if (!next || next === column.name) {
      setName(column.name);
      return;
    }
    updateColumn({ id: column.id, name: next });
    try {
      await api(`/api/columns/${column.id}`, { method: "PATCH", body: { name: next } });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Rename failed");
      updateColumn({ id: column.id, name: column.name });
    }
  }

  async function remove() {
    if (column.tasks.length > 0 && !confirm(`Delete "${column.name}" and its ${column.tasks.length} tasks?`)) {
      return;
    }
    removeColumn(column.id);
    try {
      await api(`/api/columns/${column.id}`, { method: "DELETE" });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="flex max-h-full w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-2 px-1">
        {renaming ? (
          <Input
            autoFocus
            value={name}
            className="h-7 text-sm font-medium"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
              if (e.key === "Escape") {
                setName(column.name);
                setRenaming(false);
              }
            }}
            onBlur={rename}
          />
        ) : (
          <>
            <span className="text-sm font-semibold">{column.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {tasks.length}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {can.contribute(role) && (
            <button
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setComposing(true)}
              aria-label={`Add task to ${column.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {can.manage(role) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Column options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                  <Trash2 /> Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-24 flex-1 space-y-2 overflow-y-auto rounded-lg bg-secondary/50 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/30"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <SortableTaskCard task={task} onOpen={() => onOpenTask(task.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {composing && (
          <CreateTaskInline
            boardId={column.boardId}
            columnId={column.id}
            onDone={() => setComposing(false)}
          />
        )}

        {tasks.length === 0 && !composing && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {column.tasks.length === 0 ? "No tasks yet" : "No tasks match the filters"}
          </p>
        )}
      </div>
    </div>
  );
}
