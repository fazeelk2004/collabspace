import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership, can } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

/** Tasks with a due date inside [from, to) for the calendar view. */
export const GET = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId);

  const from = new Date(req.nextUrl.searchParams.get("from") ?? "");
  const to = new Date(req.nextUrl.searchParams.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new ApiError("from and to query params are required ISO dates", 400);
  }

  const boardVisibility = can.manage(membership.role)
    ? {}
    : { OR: [{ visibility: "WORKSPACE" as const }, { createdById: session.userId }] };

  const tasks = await prisma.task.findMany({
    where: {
      board: { workspaceId, ...boardVisibility },
      dueDate: { gte: from, lt: to },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      boardId: true,
      board: { select: { name: true } },
      assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  return json({ tasks });
});
