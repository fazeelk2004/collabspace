import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireBoardAccess } from "@/lib/permissions";
import { updateBoardSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToWorkspace } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";
import { TASK_INCLUDE } from "@/lib/db/task-include";

type Params = { params: Promise<{ boardId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { boardId } = await params;
  const { membership } = await requireBoardAccess(session.userId, boardId);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: { orderBy: { position: "asc" }, include: TASK_INCLUDE },
        },
      },
      channel: { select: { id: true } },
      workspace: { select: { id: true, slug: true, name: true } },
    },
  });
  return json({ board, role: membership.role });
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { boardId } = await params;
  const { board } = await requireBoardAccess(session.userId, boardId, "ADMIN");
  const data = await parseBody(req, updateBoardSchema);

  const updated = await prisma.board.update({ where: { id: boardId }, data });
  await recordActivity({
    workspaceId: board.workspaceId,
    actorId: session.userId,
    boardId,
    type: "BOARD_UPDATED",
    meta: { name: updated.name },
  });
  emitToWorkspace(board.workspaceId, EVENTS.BOARD_UPDATED, updated);
  return json({ board: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { boardId } = await params;
  const { board } = await requireBoardAccess(session.userId, boardId, "ADMIN");

  await prisma.board.delete({ where: { id: boardId } });
  await recordActivity({
    workspaceId: board.workspaceId,
    actorId: session.userId,
    type: "BOARD_DELETED",
    meta: { name: board.name },
  });
  emitToWorkspace(board.workspaceId, EVENTS.BOARD_DELETED, { boardId });
  return json({ ok: true });
});
