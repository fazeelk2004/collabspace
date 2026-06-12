"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Search, Eye } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import type { BoardDetail, Task, Role, Priority, Member } from "@/types";
import { useBoardStore } from "@/store/board-store";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { can } from "@/lib/permissions-client";
import { BoardColumn } from "./board-column";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BoardFilters = {
  search: string;
  priority: Priority | "ALL";
  assigneeId: string | "ALL";
};

export function BoardView({
  boardId,
  role,
  currentUserId,
}: {
  boardId: string;
  role: Role;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openTaskId = searchParams.get("task");

  const { board, setBoard, moveTask, viewers, addColumn } = useBoardStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [filters, setFilters] = useState<BoardFilters>({
    search: "",
    priority: "ALL",
    assigneeId: "ALL",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => api<{ board: BoardDetail }>(`/api/boards/${boardId}`),
  });

  useEffect(() => {
    if (data?.board) setBoard(data.board);
  }, [data, setBoard]);

  useBoardRealtime(boardId, currentUserId);

  const { data: membersData } = useQuery({
    queryKey: ["members", board?.workspaceId],
    queryFn: () => api<{ members: Member[] }>(`/api/workspaces/${board!.workspaceId}/members`),
    enabled: !!board?.workspaceId,
  });
  const members = useMemo(() => membersData?.members ?? [], [membersData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const allTasks = useMemo(
    () => (board?.columns ?? []).flatMap((c) => c.tasks),
    [board]
  );

  function findColumnOfTask(taskId: string): string | undefined {
    return board?.columns.find((c) => c.tasks.some((t) => t.id === taskId))?.id;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = allTasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board) return;
    const activeColumn = findColumnOfTask(String(active.id));
    // `over` is either a task or a column container.
    const overColumn =
      board.columns.find((c) => c.id === over.id)?.id ?? findColumnOfTask(String(over.id));
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move across columns live while dragging (position fixed up on drop).
    const overTasks = board.columns.find((c) => c.id === overColumn)!.tasks;
    const tempPosition = (overTasks[overTasks.length - 1]?.position ?? 0) + 1000;
    moveTask(String(active.id), overColumn, tempPosition);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !board) return;

    const taskId = String(active.id);
    const targetColumnId =
      board.columns.find((c) => c.id === over.id)?.id ?? findColumnOfTask(String(over.id));
    if (!targetColumnId) return;

    const column = board.columns.find((c) => c.id === targetColumnId)!;
    const siblings = column.tasks.filter((t) => t.id !== taskId);

    // Index where the card was dropped.
    let index = siblings.length;
    if (over.id !== targetColumnId) {
      const overIndex = siblings.findIndex((t) => t.id === over.id);
      if (overIndex !== -1) index = overIndex;
    }

    // Fractional position between neighbours: one write, no renumbering.
    const before = siblings[index - 1]?.position;
    const after = siblings[index]?.position;
    const position =
      before !== undefined && after !== undefined
        ? (before + after) / 2
        : before !== undefined
          ? before + 1000
          : after !== undefined
            ? after / 2
            : 1000;

    moveTask(taskId, targetColumnId, position); // optimistic

    try {
      await api(`/api/tasks/${taskId}/move`, {
        method: "PATCH",
        body: { columnId: targetColumnId, position },
      });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Move failed");
      // Re-sync from the server on failure.
      const fresh = await api<{ board: BoardDetail }>(`/api/boards/${boardId}`);
      setBoard(fresh.board);
    }
  }

  async function createColumn() {
    const name = columnName.trim();
    if (!name) return;
    setColumnName("");
    setAddingColumn(false);
    try {
      const { column } = await api<{ column: { id: string; boardId: string; name: string; position: number } }>(
        `/api/boards/${boardId}/columns`,
        { method: "POST", body: { name } }
      );
      addColumn({ ...column, tasks: [] });
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not create column");
    }
  }

  function closeTask() {
    router.push(pathname, { scroll: false });
  }

  if (isLoading || !board) {
    return (
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="mr-2 text-base font-semibold">
          <span className="gradient-text">{board.name}</span>
        </h2>
        {viewers.length > 1 && (
          <Badge variant="secondary" className="gap-1">
            <Eye className="h-3 w-3" /> {viewers.length} viewing
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search tasks…"
              className="h-8 w-44 pl-8 text-sm"
            />
          </div>
          <Select
            value={filters.priority}
            onValueChange={(v) => setFilters((f) => ({ ...f, priority: v as BoardFilters["priority"] }))}
          >
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.assigneeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, assigneeId: v }))}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Everyone</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4">
          {board.columns.map((column, i) => (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex min-h-0 shrink-0"
            >
              <BoardColumn
                column={column}
                role={role}
                filters={filters}
                onOpenTask={(taskId) =>
                  router.push(`${pathname}?task=${taskId}`, { scroll: false })
                }
              />
            </motion.div>
          ))}

          {can.manage(role) && (
            <div className="w-72 shrink-0">
              {addingColumn ? (
                <Input
                  autoFocus
                  value={columnName}
                  placeholder="Column name…"
                  className="h-9"
                  onChange={(e) => setColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createColumn();
                    if (e.key === "Escape") setAddingColumn(false);
                  }}
                  onBlur={() => setAddingColumn(false)}
                />
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start border border-dashed text-muted-foreground"
                  onClick={() => setAddingColumn(true)}
                >
                  <Plus /> Add column
                </Button>
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 opacity-90">
              <TaskCard task={activeTask} overlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task detail */}
      {openTaskId && (
        <TaskDetailSheet
          taskId={openTaskId}
          boardId={boardId}
          role={role}
          members={members}
          currentUserId={currentUserId}
          onClose={closeTask}
        />
      )}
    </div>
  );
}
