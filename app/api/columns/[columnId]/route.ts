import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireBoardAccess } from "@/lib/permissions";
import { updateColumnSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ columnId: string }> };

async function loadColumn(columnId: string) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) throw new ApiError("Column not found", 404);
  return column;
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { columnId } = await params;
  const column = await loadColumn(columnId);
  await requireBoardAccess(session.userId, column.boardId, "ADMIN");

  const data = await parseBody(req, updateColumnSchema);
  const updated = await prisma.column.update({ where: { id: columnId }, data });
  emitToBoard(column.boardId, EVENTS.COLUMN_UPDATED, updated);
  return json({ column: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { columnId } = await params;
  const column = await loadColumn(columnId);
  const { board } = await requireBoardAccess(session.userId, column.boardId, "ADMIN");

  await prisma.column.delete({ where: { id: columnId } });
  await recordActivity({
    workspaceId: board.workspaceId,
    actorId: session.userId,
    boardId: column.boardId,
    type: "COLUMN_DELETED",
    meta: { name: column.name },
  });
  emitToBoard(column.boardId, EVENTS.COLUMN_DELETED, { columnId });
  return json({ ok: true });
});
