"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { isPast, isToday, isThisWeek, format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CircleDashed,
  MessageSquare,
  CheckSquare,
  PartyPopper,
} from "lucide-react";
import { api } from "@/lib/fetcher";
import { cn, PRIORITY_META } from "@/lib/utils";
import type { Label, Priority } from "@/types";
import { useShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

type MyTask = {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  boardId: string;
  board: { name: string };
  column: { name: string };
  labels: { label: Label }[];
  _count: { comments: number; checklist: number };
};

type Group = {
  key: string;
  title: string;
  icon: typeof AlertTriangle;
  iconClass: string;
  tasks: MyTask[];
};

function groupTasks(tasks: MyTask[]): Group[] {
  const overdue: MyTask[] = [];
  const today: MyTask[] = [];
  const thisWeek: MyTask[] = [];
  const later: MyTask[] = [];
  const noDate: MyTask[] = [];

  for (const t of tasks) {
    if (!t.dueDate) {
      noDate.push(t);
      continue;
    }
    const due = new Date(t.dueDate);
    if (isToday(due)) today.push(t);
    else if (isPast(due)) overdue.push(t);
    else if (isThisWeek(due, { weekStartsOn: 1 })) thisWeek.push(t);
    else later.push(t);
  }

  return [
    { key: "overdue", title: "Overdue", icon: AlertTriangle, iconClass: "text-rose-400", tasks: overdue },
    { key: "today", title: "Due today", icon: CalendarClock, iconClass: "text-amber-400", tasks: today },
    { key: "week", title: "This week", icon: CalendarDays, iconClass: "text-indigo-400", tasks: thisWeek },
    { key: "later", title: "Later", icon: CalendarDays, iconClass: "text-sky-400", tasks: later },
    { key: "nodate", title: "No due date", icon: CircleDashed, iconClass: "text-slate-400", tasks: noDate },
  ].filter((g) => g.tasks.length > 0);
}

export function MyTasksView() {
  const { workspace } = useShell();

  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks", workspace.id],
    queryFn: () => api<{ tasks: MyTask[] }>(`/api/workspaces/${workspace.id}/my-tasks`),
  });

  const tasks = data?.tasks ?? [];
  const groups = groupTasks(tasks);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4 sm:p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">My tasks</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything assigned to you in {workspace.name}.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-20 text-center text-muted-foreground"
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15">
            <PartyPopper className="h-7 w-7 text-emerald-400" />
          </span>
          <p className="font-medium text-foreground">All clear!</p>
          <p className="mt-1 text-sm">Nothing is assigned to you right now.</p>
        </motion.div>
      ) : (
        groups.map((group, gi) => (
          <motion.section
            key={group.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: gi * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <group.icon className={cn("h-4 w-4", group.iconClass)} />
              {group.title}
              <span className="text-xs font-normal text-muted-foreground">
                {group.tasks.length}
              </span>
            </h3>
            <div className="divide-y rounded-2xl border bg-card shadow-sm dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03]">
              {group.tasks.map((task) => {
                const due = task.dueDate ? new Date(task.dueDate) : null;
                const overdue = group.key === "overdue";
                return (
                  <Link
                    key={task.id}
                    href={`/w/${workspace.slug}/boards/${task.boardId}?task=${task.id}`}
                    className="flex items-center gap-3 p-3.5 transition-colors hover:bg-accent/40"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PRIORITY_META[task.priority].color }}
                      title={`${PRIORITY_META[task.priority].label} priority`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.board.name} · {task.column.name}
                      </span>
                    </span>
                    {task.labels.slice(0, 2).map(({ label }) => (
                      <span
                        key={label.id}
                        className="hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:block"
                        style={{ backgroundColor: `${label.color}22`, color: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {task._count.checklist > 0 && (
                      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                        <CheckSquare className="h-3 w-3" /> {task._count.checklist}
                      </span>
                    )}
                    {task._count.comments > 0 && (
                      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                        <MessageSquare className="h-3 w-3" /> {task._count.comments}
                      </span>
                    )}
                    {due && (
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          overdue ? "font-medium text-rose-400" : "text-muted-foreground"
                        )}
                      >
                        {format(due, "MMM d")}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.section>
        ))
      )}
    </div>
  );
}
