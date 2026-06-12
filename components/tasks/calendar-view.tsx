"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/fetcher";
import { cn, PRIORITY_META } from "@/lib/utils";
import type { Priority, UserLite } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CalendarTask = {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string;
  boardId: string;
  board: { name: string };
  assignees: { user: UserLite }[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView() {
  const { workspace } = useShell();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // The visible grid spans whole weeks around the month.
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", workspace.id, month.toISOString()],
    queryFn: () =>
      api<{ tasks: CalendarTask[] }>(
        `/api/workspaces/${workspace.id}/calendar?from=${gridStart.toISOString()}&to=${new Date(
          gridEnd.getTime() + 24 * 60 * 60 * 1000
        ).toISOString()}`
      ),
  });
  const tasks = data?.tasks ?? [];

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">{format(month, "MMMM yyyy")}</span>
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="iconSm"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="iconSm"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-2">
            {d}
          </div>
        ))}
      </div>

      <motion.div
        key={month.toISOString()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-2xl border bg-border dark:border-white/[0.08] dark:bg-white/[0.06]"
      >
        {days.map((day) => {
          const dayTasks = tasks.filter((t) => isSameDay(new Date(t.dueDate), day));
          const faded = !isSameMonth(day, month);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-24 flex-col gap-1 overflow-hidden bg-card p-1.5 dark:bg-slate-900/60",
                faded && "opacity-45"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday(day)
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white"
                    : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                {dayTasks.slice(0, 3).map((task) => (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/w/${workspace.slug}/boards/${task.boardId}?task=${task.id}`}
                        className="flex items-center gap-1 rounded-md bg-accent/60 px-1.5 py-0.5 text-[11px] leading-4 transition-colors hover:bg-accent"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PRIORITY_META[task.priority].color }}
                        />
                        <span className="truncate">{task.title}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      {task.title} · {task.board.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {dayTasks.length > 3 && (
                  <span className="px-1.5 text-[10px] text-muted-foreground">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {!isLoading && tasks.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No tasks with due dates this month.
        </p>
      )}
    </div>
  );
}
