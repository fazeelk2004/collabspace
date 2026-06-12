import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const boardId = req.nextUrl.searchParams.get("boardId");
  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 30;

  const activities = await prisma.activityLog.findMany({
    where: { workspaceId, ...(boardId && { boardId }) },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      actor: { select: { id: true, name: true, image: true } },
      board: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  const hasMore = activities.length > take;
  return json({
    activities: hasMore ? activities.slice(0, take) : activities,
    nextCursor: hasMore ? activities[take - 1].id : null,
  });
});
