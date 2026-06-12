import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireBoardAccess } from "@/lib/permissions";
import { createColumnSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

type Params = { params: Promise<{ boardId: string }> };

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { boardId } = await params;
  const { board } = await requireBoardAccess(session.userId, boardId, "ADMIN");
  const { name } = await parseBody(req, createColumnSchema);

  const last = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const column = await prisma.column.create({
    data: { boardId, name, position: (last?.position ?? 0) + 1000 },
  });

  await recordActivity({
    workspaceId: board.workspaceId,
    actorId: session.userId,
    boardId,
    type: "COLUMN_CREATED",
    meta: { name },
  });
  emitToBoard(boardId, EVENTS.COLUMN_CREATED, column);
  return json({ column }, 201);
});
