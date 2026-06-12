"use client";

import { create } from "zustand";
import type { BoardDetail, Column, Task } from "@/types";

/**
 * Client state for the open Kanban board.
 * Mutations are applied optimistically by the UI and re-applied by socket
 * events for other viewers; both paths funnel through these actions so the
 * board stays consistent.
 */
type BoardState = {
  board: BoardDetail | null;
  setBoard: (board: BoardDetail) => void;

  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, toColumnId: string, position: number) => void;

  addColumn: (column: Column) => void;
  updateColumn: (column: Partial<Column> & { id: string }) => void;
  removeColumn: (columnId: string) => void;

  // presence
  viewers: string[];
  setViewers: (viewers: string[]) => void;
  editingTasks: Record<string, { id: string; name: string }>;
  setTaskEditing: (taskId: string, user: { id: string; name: string }, editing: boolean) => void;
};

const sortByPosition = <T extends { position: number }>(arr: T[]) =>
  [...arr].sort((a, b) => a.position - b.position);

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  viewers: [],
  editingTasks: {},

  setBoard: (board) => set({ board }),

  addTask: (task) =>
    set((s) => {
      if (!s.board) return s;
      return {
        board: {
          ...s.board,
          columns: s.board.columns.map((c) =>
            c.id === task.columnId
              ? // Skip if already present (own optimistic insert + socket echo).
                c.tasks.some((t) => t.id === task.id)
                ? c
                : { ...c, tasks: sortByPosition([...c.tasks, task]) }
              : c
          ),
        },
      };
    }),

  updateTask: (task) =>
    set((s) => {
      if (!s.board) return s;
      return {
        board: {
          ...s.board,
          columns: s.board.columns.map((c) => ({
            ...c,
            tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)),
          })),
        },
      };
    }),

  removeTask: (taskId) =>
    set((s) => {
      if (!s.board) return s;
      return {
        board: {
          ...s.board,
          columns: s.board.columns.map((c) => ({
            ...c,
            tasks: c.tasks.filter((t) => t.id !== taskId),
          })),
        },
      };
    }),

  moveTask: (taskId, toColumnId, position) =>
    set((s) => {
      if (!s.board) return s;
      let moved: Task | undefined;
      const stripped = s.board.columns.map((c) => {
        const found = c.tasks.find((t) => t.id === taskId);
        if (found) moved = found;
        return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
      });
      if (!moved) return s;
      const updated = { ...moved, columnId: toColumnId, position };
      return {
        board: {
          ...s.board,
          columns: stripped.map((c) =>
            c.id === toColumnId ? { ...c, tasks: sortByPosition([...c.tasks, updated]) } : c
          ),
        },
      };
    }),

  addColumn: (column) =>
    set((s) => {
      if (!s.board || s.board.columns.some((c) => c.id === column.id)) return s;
      return {
        board: {
          ...s.board,
          columns: sortByPosition([...s.board.columns, { ...column, tasks: column.tasks ?? [] }]),
        },
      };
    }),

  updateColumn: (column) =>
    set((s) => {
      if (!s.board) return s;
      return {
        board: {
          ...s.board,
          columns: sortByPosition(
            s.board.columns.map((c) => (c.id === column.id ? { ...c, ...column } : c))
          ),
        },
      };
    }),

  removeColumn: (columnId) =>
    set((s) => {
      if (!s.board) return s;
      return {
        board: { ...s.board, columns: s.board.columns.filter((c) => c.id !== columnId) },
      };
    }),

  setViewers: (viewers) => set({ viewers }),

  setTaskEditing: (taskId, user, editing) =>
    set((s) => {
      const next = { ...s.editingTasks };
      if (editing) next[taskId] = user;
      else delete next[taskId];
      return { editingTasks: next };
    }),
}));
