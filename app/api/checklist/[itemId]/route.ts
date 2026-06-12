import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { updateChecklistItemSchema } from "@/lib/validations";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ itemId: string }> };

async function loadItem(itemId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new ApiError("Checklist item not found", 404);
  return item;
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { itemId } = await params;
  const item = await loadItem(itemId);
  const { task } = await requireTaskAccess(session.userId, item.taskId, "MEMBER");
  const input = await parseBody(req, updateChecklistItemSchema);

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { text: input.text, done: input.done, position: input.position },
  });

  emitToBoard(task.boardId, EVENTS.TASK_UPDATED, { taskId: item.taskId, checklistChanged: true });
  return json({ item: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { itemId } = await params;
  const item = await loadItem(itemId);
  const { task } = await requireTaskAccess(session.userId, item.taskId, "MEMBER");

  await prisma.checklistItem.delete({ where: { id: itemId } });
  emitToBoard(task.boardId, EVENTS.TASK_UPDATED, { taskId: item.taskId, checklistChanged: true });
  return json({ ok: true });
});
