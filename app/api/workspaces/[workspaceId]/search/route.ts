import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership, can } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

/** Cross-entity workspace search powering the Cmd+K palette. */
export const GET = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ tasks: [], boards: [], channels: [], members: [] });

  // Same visibility rule as the board list: private boards only for their
  // creator and managers.
  const boardVisibility = can.manage(membership.role)
    ? {}
    : { OR: [{ visibility: "WORKSPACE" as const }, { createdById: session.userId }] };

  const [tasks, boards, channels, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        board: { workspaceId, ...boardVisibility },
        title: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        boardId: true,
        board: { select: { name: true } },
        column: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.board.findMany({
      where: { workspaceId, ...boardVisibility, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.chatChannel.findMany({
      where: { workspaceId, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, type: true },
      take: 5,
    }),
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { name: { contains: q, mode: "insensitive" } },
      },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, image: true, email: true } },
      },
      take: 5,
    }),
  ]);

  return json({ tasks, boards, channels, members });
});
