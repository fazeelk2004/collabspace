import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

/** Admin-only CSV export: ?type=tasks (default) or ?type=activity. */
export const GET = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");

  const type = req.nextUrl.searchParams.get("type") ?? "tasks";

  let csv: string;
  let filename: string;

  if (type === "tasks") {
    const tasks = await prisma.task.findMany({
      where: { board: { workspaceId } },
      include: {
        board: { select: { name: true } },
        column: { select: { name: true } },
        assignees: { include: { user: { select: { name: true } } } },
        labels: { include: { label: { select: { name: true } } } },
        createdBy: { select: { name: true } },
        _count: { select: { comments: true, attachments: true, checklist: true } },
      },
      orderBy: [{ boardId: "asc" }, { columnId: "asc" }, { position: "asc" }],
    });

    csv = toCsv(
      ["Board", "Column", "Title", "Description", "Priority", "Due date", "Assignees",
        "Labels", "Created by", "Created at", "Comments", "Attachments", "Checklist items"],
      tasks.map((t) => [
        t.board.name,
        t.column.name,
        t.title,
        t.description ?? "",
        t.priority,
        t.dueDate?.toISOString().slice(0, 10) ?? "",
        t.assignees.map((a) => a.user.name).join("; "),
        t.labels.map((l) => l.label.name).join("; "),
        t.createdBy?.name ?? "",
        t.createdAt.toISOString(),
        t._count.comments,
        t._count.attachments,
        t._count.checklist,
      ])
    );
    filename = "tasks";
  } else if (type === "activity") {
    const activities = await prisma.activityLog.findMany({
      where: { workspaceId },
      include: {
        actor: { select: { name: true, email: true } },
        board: { select: { name: true } },
        task: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    csv = toCsv(
      ["Timestamp", "Type", "Actor", "Actor email", "Board", "Task", "Details"],
      activities.map((a) => [
        a.createdAt.toISOString(),
        a.type,
        a.actor?.name ?? "",
        a.actor?.email ?? "",
        a.board?.name ?? "",
        a.task?.title ?? "",
        a.meta ? JSON.stringify(a.meta) : "",
      ])
    );
    filename = "activity";
  } else {
    throw new ApiError("Unknown export type", 400);
  }

  // BOM so Excel opens the file as UTF-8.
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="collabspace-${filename}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
});
