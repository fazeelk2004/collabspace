import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireDmAccess } from "@/lib/permissions";
import { chatMessageSchema } from "@/lib/validations";
import { emitToDm, emitToUser } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ threadId: string }> };

const MESSAGE_INCLUDE = {
  author: { select: { id: true, name: true, image: true } },
  reactions: { select: { emoji: true, userId: true } },
  parent: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      author: { select: { id: true, name: true } },
    },
  },
} as const;

export const GET = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { threadId } = await params;
  await requireDmAccess(session.userId, threadId);

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 50;

  const messages = await prisma.chatMessage.findMany({
    where: { dmThreadId: threadId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: MESSAGE_INCLUDE,
  });

  const hasMore = messages.length > take;
  return json({
    messages: (hasMore ? messages.slice(0, take) : messages).reverse(),
    nextCursor: hasMore ? messages[take - 1].id : null,
  });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId, "chat");
  const { threadId } = await params;
  await requireDmAccess(session.userId, threadId);
  const { body, parentId } = await parseBody(req, chatMessageSchema);

  if (parentId) {
    const parent = await prisma.chatMessage.findUnique({
      where: { id: parentId },
      select: { dmThreadId: true },
    });
    if (!parent || parent.dmThreadId !== threadId) {
      throw new ApiError("Cannot reply to that message", 400);
    }
  }

  const message = await prisma.chatMessage.create({
    data: { dmThreadId: threadId, authorId: session.userId, body, parentId },
    include: MESSAGE_INCLUDE,
  });
  // Bump thread for sorting in the conversation list.
  await prisma.directMessageThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  emitToDm(threadId, EVENTS.CHAT_MESSAGE, { ...message, dmThreadId: threadId });

  // Also ping the other participant's personal room so the DM list updates
  // even when they don't have this conversation open.
  const participants = await prisma.directMessageParticipant.findMany({
    where: { threadId, userId: { not: session.userId } },
    select: { userId: true },
  });
  for (const p of participants) {
    emitToUser(p.userId, EVENTS.CHAT_MESSAGE, { ...message, dmThreadId: threadId });
  }

  return json({ message }, 201);
});
