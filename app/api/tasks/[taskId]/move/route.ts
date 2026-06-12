import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { moveTaskSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");
  const { columnId, position } = await parseBody(req, moveTaskSchema);

  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { id: true, boardId: true, name: true },
  });
  // The target column must belong to the same board — prevents moving tasks
  // across tenant boundaries with a crafted request.
  if (!column || column.boardId !== task.boardId) {
    throw new ApiError("Target column not found on this board", 400);
  }

  const fromColumnId = task.columnId;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { columnId, position, updatedById: session.userId },
    select: { id: true, columnId: true, position: true, title: true },
  });

  if (fromColumnId !== columnId) {
    await recordActivity({
      workspaceId,
      actorId: session.userId,
      boardId: task.boardId,
      taskId,
      type: "TASK_MOVED",
      meta: { title: task.title, toColumn: column.name },
    });
  }

  emitToBoard(task.boardId, EVENTS.TASK_MOVED, {
    taskId,
    fromColumnId,
    toColumnId: columnId,
    position,
    movedBy: session.userId,
  });
  return json({ task: updated });
});
