import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string; invitationId: string }> };

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId, invitationId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.workspaceId !== workspaceId) {
    throw new ApiError("Invitation not found", 404);
  }
  await prisma.invitation.delete({ where: { id: invitationId } });
  return json({ ok: true });
});
