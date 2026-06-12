"use client";

import { useSocketEvent, useBoardRoom } from "@/hooks/use-socket";
import { useBoardStore } from "@/store/board-store";
import { EVENTS } from "@/server/events";
import type { Task, Column } from "@/types";

/**
 * Wires the board store to real-time socket events.
 * Mount once per open board: joins the board room and applies every
 * task/column/presence event coming from other users.
 */
export function useBoardRealtime(boardId: string, currentUserId: string) {
  useBoardRoom(boardId);

  const store = useBoardStore();

  useSocketEvent<Task>(EVENTS.TASK_CREATED, (task) => {
    if (task.boardId === boardId) store.addTask(task);
  });

  useSocketEvent<Task>(EVENTS.TASK_UPDATED, (task) => {
    if (task.boardId === boardId) store.updateTask(task);
  });

  useSocketEvent<{ taskId: string; toColumnId: string; position: number; movedBy: string }>(
    EVENTS.TASK_MOVED,
    (p) => {
      // Our own moves are already applied optimistically.
      if (p.movedBy !== currentUserId) store.moveTask(p.taskId, p.toColumnId, p.position);
    }
  );

  useSocketEvent<{ taskId: string }>(EVENTS.TASK_DELETED, (p) => store.removeTask(p.taskId));

  useSocketEvent<Column>(EVENTS.COLUMN_CREATED, (column) => {
    if (column.boardId === boardId) store.addColumn({ ...column, tasks: column.tasks ?? [] });
  });
  useSocketEvent<Column>(EVENTS.COLUMN_UPDATED, (column) => store.updateColumn(column));
  useSocketEvent<{ columnId: string }>(EVENTS.COLUMN_DELETED, (p) => store.removeColumn(p.columnId));

  useSocketEvent<{ boardId: string; viewers: string[] }>(EVENTS.BOARD_VIEWERS, (p) => {
    if (p.boardId === boardId) store.setViewers(p.viewers);
  });

  useSocketEvent<{ taskId: string; user: { id: string; name: string }; editing: boolean }>(
    EVENTS.TASK_EDITING,
    (p) => store.setTaskEditing(p.taskId, p.user, p.editing)
  );
}
