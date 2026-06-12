import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { inviteMemberSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { sendInviteEmail } from "@/lib/email";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");

  const invitations = await prisma.invitation.findMany({
    where: { workspaceId, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return json({ invitations });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");
  const { email, role } = await parseBody(req, inviteMemberSchema);
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (existingMember) throw new ApiError("This user is already a member", 409);
  }

  // Re-inviting replaces any previous invitation for this email.
  const invitation = await prisma.invitation.upsert({
    where: { workspaceId_email: { workspaceId, email: normalizedEmail } },
    create: {
      workspaceId,
      email: normalizedEmail,
      role,
      invitedById: session.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {
      role,
      status: "PENDING",
      invitedById: session.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    type: "MEMBER_INVITED",
    meta: { email: normalizedEmail, role },
  });

  const [inviter, workspace] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
  ]);
  await sendInviteEmail({
    to: normalizedEmail,
    inviterName: inviter?.name ?? "A teammate",
    workspaceName: workspace?.name ?? "a workspace",
    role,
    token: invitation.token,
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;
  return json({ invitation, inviteUrl }, 201);
});
