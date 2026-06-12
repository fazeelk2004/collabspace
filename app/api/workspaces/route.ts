import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";
import { createWorkspaceSchema } from "@/lib/validations";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.userId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          _count: { select: { members: true, boards: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return json({
    workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId, "mutation");
  const { name } = await parseBody(req, createWorkspaceSchema);

  // Workspace + owner membership + default board/columns + #general channel,
  // all in one transaction so a failure leaves nothing half-created.
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name,
        slug: slugify(name),
        createdById: session.userId,
        members: { create: { userId: session.userId, role: "OWNER" } },
        channels: { create: { name: "general", type: "WORKSPACE" } },
        labels: {
          createMany: {
            data: [
              { name: "Bug", color: "#ef4444" },
              { name: "Feature", color: "#8b5cf6" },
              { name: "Improvement", color: "#06b6d4" },
            ],
          },
        },
      },
    });

    await tx.board.create({
      data: {
        workspaceId: ws.id,
        name: "Getting Started",
        createdById: session.userId,
        columns: {
          createMany: {
            data: [
              { name: "To Do", position: 1000 },
              { name: "In Progress", position: 2000 },
              { name: "Review", position: 3000 },
              { name: "Done", position: 4000 },
            ],
          },
        },
      },
    });

    return ws;
  });

  return json({ workspace }, 201);
});
