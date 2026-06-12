import { WorkspaceRole, BoardVisibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Central role/permission logic, shared by API route handlers and Socket.io
 * handlers. Client-provided role data is never consulted — the membership row
 * is always loaded fresh from PostgreSQL.
 */

export { roleAtLeast, can } from "@/lib/permissions-client";
import { roleAtLeast, can } from "@/lib/permissions-client";

export class PermissionError extends Error {
  status: number;
  constructor(message = "You don't have permission to perform this action", status = 403) {
    super(message);
    this.status = status;
  }
}

export type MembershipContext = {
  membership: { id: string; role: WorkspaceRole; userId: string };
  workspaceId: string;
};

/** Load the caller's membership in a workspace; throws 403 if not a member. */
export async function requireMembership(
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole = "VIEWER"
): Promise<MembershipContext> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) throw new PermissionError("Not a member of this workspace", 403);
  if (!roleAtLeast(membership.role, minimumRole)) {
    throw new PermissionError(`Requires ${minimumRole.toLowerCase()} access or higher`);
  }
  return { membership, workspaceId };
}

/** Resolve a board, verify membership in its workspace and board visibility. */
export async function requireBoardAccess(
  userId: string,
  boardId: string,
  minimumRole: WorkspaceRole = "VIEWER"
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, workspaceId: true, visibility: true, createdById: true, name: true },
  });
  if (!board) throw new PermissionError("Board not found", 404);

  const ctx = await requireMembership(userId, board.workspaceId, minimumRole);

  if (
    board.visibility === BoardVisibility.PRIVATE &&
    board.createdById !== userId &&
    !can.manage(ctx.membership.role)
  ) {
    throw new PermissionError("This board is private", 403);
  }
  return { board, ...ctx };
}

/** Resolve a task through its board, applying the same checks. */
export async function requireTaskAccess(
  userId: string,
  taskId: string,
  minimumRole: WorkspaceRole = "VIEWER"
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, boardId: true, columnId: true, title: true },
  });
  if (!task) throw new PermissionError("Task not found", 404);
  const access = await requireBoardAccess(userId, task.boardId, minimumRole);
  return { task, ...access };
}

/** Verify channel membership (workspace channel or board channel). */
export async function requireChannelAccess(
  userId: string,
  channelId: string,
  minimumRole: WorkspaceRole = "VIEWER"
) {
  const channel = await prisma.chatChannel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true, boardId: true, name: true, type: true },
  });
  if (!channel) throw new PermissionError("Channel not found", 404);
  const ctx = await requireMembership(userId, channel.workspaceId, minimumRole);
  if (channel.boardId) {
    // Board channels inherit board visibility rules.
    await requireBoardAccess(userId, channel.boardId, minimumRole);
  }
  return { channel, ...ctx };
}

/** Verify the caller participates in a DM thread. */
export async function requireDmAccess(userId: string, threadId: string) {
  const participant = await prisma.directMessageParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
    select: { id: true, thread: { select: { workspaceId: true } } },
  });
  if (!participant) throw new PermissionError("Not a participant of this conversation", 403);
  await requireMembership(userId, participant.thread.workspaceId);
  return { workspaceId: participant.thread.workspaceId };
}

/** Guard: a workspace must always retain at least one owner. */
export async function assertNotLastOwner(workspaceId: string, memberUserId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    select: { role: true },
  });
  if (member?.role !== "OWNER") return;
  const ownerCount = await prisma.workspaceMember.count({
    where: { workspaceId, role: "OWNER" },
  });
  if (ownerCount <= 1) {
    throw new PermissionError("A workspace must have at least one owner", 400);
  }
}
