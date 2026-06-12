import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return json({ members });
});
