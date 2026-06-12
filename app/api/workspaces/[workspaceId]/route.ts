import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { updateWorkspaceSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { _count: { select: { members: true, boards: true } } },
  });
  return json({ workspace, role: membership.role });
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");

  const data = await parseBody(req, updateWorkspaceSchema);
  const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    type: "WORKSPACE_UPDATED",
    meta: { name: workspace.name },
  });
  return json({ workspace });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  // Only owners can delete; everything inside cascades at the DB level.
  await requireMembership(session.userId, workspaceId, "OWNER");
  await prisma.workspace.delete({ where: { id: workspaceId } });
  return json({ ok: true });
});
