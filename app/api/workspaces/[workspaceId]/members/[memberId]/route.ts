import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership, assertNotLastOwner, roleAtLeast, PermissionError } from "@/lib/permissions";
import { updateMemberRoleSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { emitToWorkspace } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string; memberId: string }> };

async function loadTarget(workspaceId: string, memberId: string) {
  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  if (!target || target.workspaceId !== workspaceId) {
    throw new ApiError("Member not found", 404);
  }
  return target;
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId, memberId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId, "ADMIN");
  const { role } = await parseBody(req, updateMemberRoleSchema);
  const target = await loadTarget(workspaceId, memberId);

  // Admins cannot touch owners or promote to owner; owners can do both.
  if (membership.role !== "OWNER" && (target.role === "OWNER" || role === "OWNER")) {
    throw new PermissionError("Only owners can manage owner roles");
  }
  if (target.role === "OWNER" && role !== "OWNER") {
    await assertNotLastOwner(workspaceId, target.userId);
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    type: "MEMBER_ROLE_CHANGED",
    meta: { memberName: target.user.name, role },
  });
  await createNotification({
    workspaceId,
    recipientId: target.userId,
    actorId: session.userId,
    type: "ROLE_CHANGED",
    meta: { role },
  });
  emitToWorkspace(workspaceId, EVENTS.MEMBER_UPDATED, updated);
  return json({ member: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId, memberId } = await params;
  const { membership } = await requireMembership(session.userId, workspaceId, "VIEWER");
  const target = await loadTarget(workspaceId, memberId);

  const isSelf = target.userId === session.userId;
  // Leaving is allowed for anyone; removing others needs admin, and
  // admins cannot remove members at or above their own level.
  if (!isSelf) {
    if (!roleAtLeast(membership.role, "ADMIN")) {
      throw new PermissionError("Requires admin access");
    }
    if (membership.role !== "OWNER" && roleAtLeast(target.role, "ADMIN")) {
      throw new PermissionError("Admins cannot remove admins or owners");
    }
  }
  await assertNotLastOwner(workspaceId, target.userId);

  await prisma.workspaceMember.delete({ where: { id: memberId } });
  await recordActivity({
    workspaceId,
    actorId: session.userId,
    type: "MEMBER_REMOVED",
    meta: { memberName: target.user.name, left: isSelf },
  });
  emitToWorkspace(workspaceId, EVENTS.MEMBER_REMOVED, { memberId, userId: target.userId });
  return json({ ok: true });
});
