import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { emitToBoard, emitToWorkspace } from "@/server/emitter";
import { EVENTS } from "@/server/events";

export type ActivityInput = {
  workspaceId: string;
  actorId: string;
  type: ActivityType;
  boardId?: string | null;
  taskId?: string | null;
  meta?: Prisma.InputJsonValue;
};

/** Write an activity row and broadcast it to the relevant rooms. */
export async function recordActivity(input: ActivityInput) {
  const activity = await prisma.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      type: input.type,
      boardId: input.boardId ?? null,
      taskId: input.taskId ?? null,
      meta: input.meta,
    },
    include: {
      actor: { select: { id: true, name: true, image: true } },
    },
  });

  emitToWorkspace(input.workspaceId, EVENTS.ACTIVITY_NEW, activity);
  if (input.boardId) emitToBoard(input.boardId, EVENTS.ACTIVITY_NEW, activity);

  return activity;
}
