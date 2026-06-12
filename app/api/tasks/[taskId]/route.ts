import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { updateTaskSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { sendTaskAssignedEmail } from "@/lib/email";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { TASK_INCLUDE } from "@/lib/db/task-include";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { taskId } = await params;
  await requireTaskAccess(session.userId, taskId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      ...TASK_INCLUDE,
      updatedBy: { select: { id: true, name: true, image: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, image: true } } },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { id: true, name: true, image: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { id: true, name: true, image: true } } },
      },
      column: { select: { id: true, name: true } },
    },
  });
  return json({ task });
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");
  const input = await parseBody(req, updateTaskSchema);

  if (input.assigneeIds) {
    const count = await prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: input.assigneeIds } },
    });
    if (count !== input.assigneeIds.length) {
      throw new ApiError("One or more assignees are not workspace members", 400);
    }
  }
  if (input.labelIds) {
    const count = await prisma.label.count({ where: { workspaceId, id: { in: input.labelIds } } });
    if (count !== input.labelIds.length) throw new ApiError("Invalid label", 400);
  }

  const before = await prisma.task.findUnique({
    where: { id: taskId },
    select: { priority: true, assignees: { select: { userId: true } } },
  });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
      updatedById: session.userId,
      ...(input.assigneeIds && {
        assignees: {
          deleteMany: {},
          createMany: { data: input.assigneeIds.map((userId) => ({ userId })) },
        },
      }),
      ...(input.labelIds && {
        labels: {
          deleteMany: {},
          createMany: { data: input.labelIds.map((labelId) => ({ labelId })) },
        },
      }),
    },
    include: TASK_INCLUDE,
  });

  const isPriorityChange = input.priority && input.priority !== before?.priority;
  await recordActivity({
    workspaceId,
    actorId: session.userId,
    boardId: task.boardId,
    taskId,
    type: isPriorityChange ? "TASK_PRIORITY_CHANGED" : "TASK_UPDATED",
    meta: { title: updated.title, ...(isPriorityChange && { priority: input.priority }) },
  });

  // Notify newly assigned users only.
  if (input.assigneeIds) {
    const previous = new Set(before?.assignees.map((a) => a.userId) ?? []);
    const added = input.assigneeIds.filter((id) => !previous.has(id));
    if (added.length) {
      await recordActivity({
        workspaceId,
        actorId: session.userId,
        boardId: task.boardId,
        taskId,
        type: "TASK_ASSIGNED",
        meta: { title: updated.title, count: added.length },
      });
      await notifyMany(added, {
        workspaceId,
        actorId: session.userId,
        type: "TASK_ASSIGNED",
        taskId,
        meta: { taskTitle: updated.title, boardId: task.boardId },
      });

      const [actor, workspace, recipients] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
        prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } }),
        prisma.user.findMany({
          where: { id: { in: added.filter((id) => id !== session.userId) } },
          select: { email: true },
        }),
      ]);
      if (workspace) {
        await Promise.all(
          recipients.map((r) =>
            sendTaskAssignedEmail({
              to: r.email,
              actorName: actor?.name ?? "A teammate",
              taskTitle: updated.title,
              workspaceSlug: workspace.slug,
              boardId: task.boardId,
              taskId,
            })
          )
        );
      }
    }
  }

  emitToBoard(task.boardId, EVENTS.TASK_UPDATED, updated);
  return json({ task: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");

  await prisma.task.delete({ where: { id: taskId } });
  await recordActivity({
    workspaceId,
    actorId: session.userId,
    boardId: task.boardId,
    type: "TASK_DELETED",
    meta: { title: task.title },
  });
  emitToBoard(task.boardId, EVENTS.TASK_DELETED, { taskId, columnId: task.columnId });
  return json({ ok: true });
});
