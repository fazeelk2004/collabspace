import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership, can } from "@/lib/permissions";
import { createBoardSchema, BOARD_TEMPLATES } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToWorkspace } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId);

  const boards = await prisma.board.findMany({
    where: {
      workspaceId,
      // Private boards are visible to their creator and to admins/owners.
      ...(can.manage(membership.role)
        ? {}
        : { OR: [{ visibility: "WORKSPACE" }, { createdById: session.userId }] }),
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return json({ boards });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");
  const { name, description, visibility, template = "blank" } = await parseBody(req, createBoardSchema);

  const board = await prisma.board.create({
    data: {
      workspaceId,
      name,
      description,
      visibility,
      createdById: session.userId,
      columns: {
        createMany: {
          data: BOARD_TEMPLATES[template].columns.map((columnName, i) => ({
            name: columnName,
            position: (i + 1) * 1000,
          })),
        },
      },
      // Every board gets its own discussion channel.
      channel: { create: { workspaceId, name: name.toLowerCase(), type: "BOARD" } },
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { tasks: true } },
    },
  });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    boardId: board.id,
    type: "BOARD_CREATED",
    meta: { name },
  });
  emitToWorkspace(workspaceId, EVENTS.BOARD_CREATED, board);
  return json({ board }, 201);
});
