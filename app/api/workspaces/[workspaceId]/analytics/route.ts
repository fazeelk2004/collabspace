import { NextRequest } from "next/server";
import { subDays, startOfDay, format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

/**
 * Workspace analytics. "Completed" = tasks sitting in a column named "Done"
 * (case-insensitive) — a pragmatic convention that avoids a separate status field.
 */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const doneColumns = await prisma.column.findMany({
    where: { board: { workspaceId }, name: { equals: "Done", mode: "insensitive" } },
    select: { id: true },
  });
  const doneIds = doneColumns.map((c) => c.id);
  const now = new Date();

  const [total, completed, overdue, byPriority, tasksWithAssignees, recentDone] =
    await Promise.all([
      prisma.task.count({ where: { board: { workspaceId } } }),
      prisma.task.count({ where: { board: { workspaceId }, columnId: { in: doneIds } } }),
      prisma.task.count({
        where: {
          board: { workspaceId },
          dueDate: { lt: now },
          columnId: { notIn: doneIds },
        },
      }),
      prisma.task.groupBy({
        by: ["priority"],
        where: { board: { workspaceId } },
        _count: true,
      }),
      prisma.taskAssignee.groupBy({
        by: ["userId"],
        where: { task: { board: { workspaceId } } },
        _count: true,
      }),
      prisma.task.findMany({
        where: {
          board: { workspaceId },
          columnId: { in: doneIds },
          updatedAt: { gte: subDays(now, 14) },
        },
        select: { updatedAt: true },
      }),
    ]);

  // Resolve member names for the by-member chart.
  const users = await prisma.user.findMany({
    where: { id: { in: tasksWithAssignees.map((t) => t.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  // 14-day completion trend.
  const trend: { date: string; completed: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = startOfDay(subDays(now, i));
    const next = startOfDay(subDays(now, i - 1));
    trend.push({
      date: format(day, "MMM d"),
      completed: recentDone.filter((t) => t.updatedAt >= day && t.updatedAt < next).length,
    });
  }

  return json({
    totals: {
      total,
      completed,
      overdue,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    },
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
    byMember: tasksWithAssignees.map((t) => ({
      userId: t.userId,
      name: nameById.get(t.userId) ?? "Unknown",
      count: t._count,
    })),
    trend,
  });
});
