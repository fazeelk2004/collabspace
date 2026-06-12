import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { checklistItemSchema } from "@/lib/validations";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { taskId } = await params;
  await requireTaskAccess(session.userId, taskId);

  const items = await prisma.checklistItem.findMany({
    where: { taskId },
    orderBy: { position: "asc" },
  });
  return json({ items });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task } = await requireTaskAccess(session.userId, taskId, "MEMBER");
  const { text } = await parseBody(req, checklistItemSchema);

  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const item = await prisma.checklistItem.create({
    data: { taskId, text, position: (last?.position ?? 0) + 1000 },
  });

  emitToBoard(task.boardId, EVENTS.TASK_UPDATED, { taskId, checklistChanged: true });
  return json({ item }, 201);
});
