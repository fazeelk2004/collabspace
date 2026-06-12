import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess, can, PermissionError } from "@/lib/permissions";
import { commentSchema } from "@/lib/validations";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ commentId: string }> };

async function loadComment(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: { select: { id: true, boardId: true } } },
  });
  if (!comment) throw new ApiError("Comment not found", 404);
  return comment;
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { commentId } = await params;
  const comment = await loadComment(commentId);
  await requireTaskAccess(session.userId, comment.task.id, "MEMBER");

  // Only the author may edit their comment.
  if (comment.authorId !== session.userId) {
    throw new PermissionError("You can only edit your own comments");
  }

  const { body } = await parseBody(req, commentSchema);
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body, editedAt: new Date() },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  emitToBoard(comment.task.boardId, EVENTS.COMMENT_UPDATED, { ...updated, taskId: comment.task.id });
  return json({ comment: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { commentId } = await params;
  const comment = await loadComment(commentId);
  const { membership } = await requireTaskAccess(session.userId, comment.task.id, "MEMBER");

  // Authors can delete their own comments; admins can moderate any.
  if (comment.authorId !== session.userId && !can.manage(membership.role)) {
    throw new PermissionError("You can only delete your own comments");
  }

  await prisma.comment.delete({ where: { id: commentId } });
  emitToBoard(comment.task.boardId, EVENTS.COMMENT_DELETED, {
    commentId,
    taskId: comment.task.id,
  });
  return json({ ok: true });
});
