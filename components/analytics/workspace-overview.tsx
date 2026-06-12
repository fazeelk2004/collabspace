"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/fetcher";
import type { AnalyticsData, Activity } from "@/types";
import { PRIORITY_META } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/ui/count-up";
import { ActivityList } from "@/components/activity/activity-list";
import { AnalyticsCharts } from "./analytics-charts";

const STAT_CARDS = [
  { key: "total", label: "Total tasks", icon: ListTodo, accent: "from-sky-500 to-cyan-500" },
  { key: "completed", label: "Completed", icon: CheckCircle2, accent: "from-emerald-500 to-teal-500" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, accent: "from-rose-500 to-pink-500" },
  { key: "completionRate", label: "Completion", icon: TrendingUp, accent: "from-indigo-500 to-violet-500", suffix: "%" },
] as const;

export function WorkspaceOverview({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics", workspaceId],
    queryFn: () => api<AnalyticsData>(`/api/workspaces/${workspaceId}/analytics`),
  });

  const { data: activityData } = useQuery({
    queryKey: ["activity", workspaceId],
    queryFn: () =>
      api<{ activities: Activity[] }>(`/api/workspaces/${workspaceId}/activity`),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">{workspaceName}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Workspace overview — tasks, progress and recent activity.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat, i) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: [0.21, 0.47, 0.32, 0.98] }}
            whileHover={{ y: -3 }}
          >
            <Card className="group relative overflow-hidden transition-colors dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.16]">
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${stat.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25`}
              />
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stat.accent} text-white shadow-lg`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">
                      <CountUp
                        value={analytics?.totals[stat.key] ?? 0}
                        suffix={"suffix" in stat ? stat.suffix : ""}
                      />
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Charts */}
        <div className="space-y-6 lg:col-span-2">
          {isLoading || !analytics ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <AnalyticsCharts analytics={analytics} />
          )}
        </div>

        {/* Recent activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <Card className="dark:border-white/[0.08] dark:bg-white/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[28rem] overflow-y-auto">
              <ActivityList activities={(activityData?.activities ?? []).slice(0, 15)} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Priority legend */}
      {analytics && analytics.totals.total > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {analytics.byPriority.map((p) => (
            <span key={p.priority} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PRIORITY_META[p.priority].color }}
              />
              {PRIORITY_META[p.priority].label}: {p.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
