import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

/** Every task in this workspace assigned to the current user. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const tasks = await prisma.task.findMany({
    where: {
      board: { workspaceId },
      assignees: { some: { userId: session.userId } },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      boardId: true,
      board: { select: { name: true } },
      column: { select: { name: true } },
      labels: { include: { label: true } },
      _count: { select: { comments: true, checklist: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  });

  return json({ tasks });
});
