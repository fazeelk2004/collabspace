import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { emitToUser } from "@/server/emitter";
import { EVENTS } from "@/server/events";

export type NotificationInput = {
  workspaceId: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  taskId?: string | null;
  meta?: Prisma.InputJsonValue;
};

/** Create a notification and push it to the recipient in real time. */
export async function createNotification(input: NotificationInput) {
  // Never notify yourself.
  if (input.recipientId === input.actorId) return null;

  const notification = await prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      taskId: input.taskId ?? null,
      meta: input.meta,
    },
    include: {
      actor: { select: { id: true, name: true, image: true } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  emitToUser(input.recipientId, EVENTS.NOTIFICATION_NEW, notification);
  return notification;
}

/** Notify several recipients (e.g. all mentioned users) at once. */
export async function notifyMany(
  recipientIds: string[],
  base: Omit<NotificationInput, "recipientId">
) {
  await Promise.all(
    [...new Set(recipientIds)]
      .filter((id) => id !== base.actorId)
      .map((recipientId) => createNotification({ ...base, recipientId }))
  );
}
