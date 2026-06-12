import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { commentSchema } from "@/lib/validations";
import { extractMentionIds } from "@/lib/utils";
import { recordActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { sendMentionEmail } from "@/lib/email";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { taskId } = await params;
  await requireTaskAccess(session.userId, taskId);

  const comments = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return json({ comments });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");
  const { body } = await parseBody(req, commentSchema);

  const comment = await prisma.comment.create({
    data: { taskId, authorId: session.userId, body },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  await recordActivity({
    workspaceId,
    actorId: session.userId,
    boardId: task.boardId,
    taskId,
    type: "COMMENT_ADDED",
    meta: { title: task.title },
  });

  // @mentions → notifications (only for users who are actually members).
  const mentionIds = extractMentionIds(body);
  if (mentionIds.length) {
    const validMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: mentionIds } },
      select: { userId: true, user: { select: { email: true } }, workspace: { select: { slug: true } } },
    });
    await notifyMany(
      validMembers.map((m) => m.userId),
      {
        workspaceId,
        actorId: session.userId,
        type: "MENTIONED_COMMENT",
        taskId,
        meta: { taskTitle: task.title, boardId: task.boardId },
      }
    );
    await Promise.all(
      validMembers
        .filter((m) => m.userId !== session.userId)
        .map((m) =>
          sendMentionEmail({
            to: m.user.email,
            actorName: comment.author?.name ?? "A teammate",
            context: "comment",
            snippet: body,
            url: `/w/${m.workspace.slug}/boards/${task.boardId}?task=${taskId}`,
          })
        )
    );
  }

  emitToBoard(task.boardId, EVENTS.COMMENT_ADDED, { ...comment, taskId });
  return json({ comment }, 201);
});
