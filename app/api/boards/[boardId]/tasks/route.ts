import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireBoardAccess } from "@/lib/permissions";
import { createTaskSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";
import { TASK_INCLUDE } from "@/lib/db/task-include";

type Params = { params: Promise<{ boardId: string }> };

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { boardId } = await params;
  const { board, workspaceId } = await requireBoardAccess(session.userId, boardId, "MEMBER");
  const input = await parseBody(req, createTaskSchema);

  const column = await prisma.column.findUnique({ where: { id: input.columnId } });
  if (!column || column.boardId !== boardId) throw new ApiError("Column not found", 404);

  // Assignees and labels must belong to this workspace — never trust raw ids.
  if (input.assigneeIds?.length) {
    const count = await prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: input.assigneeIds } },
    });
    if (count !== input.assigneeIds.length) {
      throw new ApiError("One or more assignees are not workspace members", 400);
    }
  }
  if (input.labelIds?.length) {
    const count = await prisma.label.count({
      where: { workspaceId, id: { in: input.labelIds } },
    });
    if (count !== input.labelIds.length) throw new ApiError("Invalid label", 400);
  }

  const last = await prisma.task.findFirst({
    where: { columnId: input.columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      boardId,
      columnId: input.columnId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      position: (last?.position ?? 0) + 1000,
      createdById: session.userId,
      updatedById: session.userId,
      assignees: { createMany: { data: (input.assigneeIds ?? []).map((userId) => ({ userId })) } },
      labels: { createMany: { data: (input.labelIds ?? []).map((labelId) => ({ labelId })) } },
    },
    include: TASK_INCLUDE,
  });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    boardId,
    taskId: task.id,
    type: "TASK_CREATED",
    meta: { title: task.title, boardName: board.name },
  });
  if (input.assigneeIds?.length) {
    await notifyMany(input.assigneeIds, {
      workspaceId,
      actorId: session.userId,
      type: "TASK_ASSIGNED",
      taskId: task.id,
      meta: { taskTitle: task.title, boardId },
    });
  }

  emitToBoard(boardId, EVENTS.TASK_CREATED, task);
  return json({ task }, 201);
});
