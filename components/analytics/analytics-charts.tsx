"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { AnalyticsData } from "@/types";
import { PRIORITY_META } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalyticsCharts({ analytics }: { analytics: AnalyticsData }) {
  const priorityData = analytics.byPriority.map((p) => ({
    name: PRIORITY_META[p.priority].label,
    value: p.count,
    color: PRIORITY_META[p.priority].color,
  }));

  const memberData = analytics.byMember
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((m) => ({ name: m.name.split(" ")[0], tasks: m.count }));

  return (
    <>
      {/* 14-day completion trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks completed — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics.trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#trendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Tasks by priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By priority</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by member */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By member</CardTitle>
          </CardHeader>
          <CardContent>
            {memberData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No assigned tasks yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={memberData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="tasks" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
