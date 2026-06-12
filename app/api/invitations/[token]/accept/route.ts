import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { recordActivity } from "@/lib/activity";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ token: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, slug: true, name: true } } },
  });
  if (!invitation || invitation.status !== "PENDING") {
    throw new ApiError("Invitation not found or already used", 404);
  }
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { token }, data: { status: "EXPIRED" } });
    throw new ApiError("This invitation has expired", 410);
  }
  // The invite is bound to an email — only that account may accept it.
  if (invitation.email !== session.email.toLowerCase()) {
    throw new ApiError("This invitation was sent to a different email address", 403);
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: session.userId } },
  });
  if (existing) {
    await prisma.invitation.update({ where: { token }, data: { status: "ACCEPTED" } });
    return json({ workspace: invitation.workspace, alreadyMember: true });
  }

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: session.userId,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({ where: { token }, data: { status: "ACCEPTED" } }),
  ]);

  await recordActivity({
    workspaceId: invitation.workspaceId,
    actorId: session.userId,
    type: "MEMBER_JOINED",
    meta: { name: session.name },
  });

  return json({ workspace: invitation.workspace });
});
