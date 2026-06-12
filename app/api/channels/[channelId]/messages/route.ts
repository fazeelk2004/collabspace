import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireChannelAccess } from "@/lib/permissions";
import { chatMessageSchema } from "@/lib/validations";
import { extractMentionIds } from "@/lib/utils";
import { notifyMany } from "@/lib/notifications";
import { sendMentionEmail } from "@/lib/email";
import { emitToChannel } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ channelId: string }> };

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
  const { channelId } = await params;
  await requireChannelAccess(session.userId, channelId);

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 50;

  // Newest first with cursor pagination; the client reverses for display.
  const messages = await prisma.chatMessage.findMany({
    where: { channelId },
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
  const { channelId } = await params;
  const { channel, workspaceId } = await requireChannelAccess(
    session.userId,
    channelId,
    "MEMBER"
  );
  const { body, parentId } = await parseBody(req, chatMessageSchema);

  // Replies must point at a message in this same channel.
  if (parentId) {
    const parent = await prisma.chatMessage.findUnique({
      where: { id: parentId },
      select: { channelId: true },
    });
    if (!parent || parent.channelId !== channelId) {
      throw new ApiError("Cannot reply to that message", 400);
    }
  }

  const message = await prisma.chatMessage.create({
    data: { channelId, authorId: session.userId, body, parentId },
    include: MESSAGE_INCLUDE,
  });

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
        type: "MENTIONED_CHAT",
        meta: { channelId, channelName: channel.name },
      }
    );
    await Promise.all(
      validMembers
        .filter((m) => m.userId !== session.userId)
        .map((m) =>
          sendMentionEmail({
            to: m.user.email,
            actorName: message.author?.name ?? "A teammate",
            context: "chat",
            snippet: body,
            url: `/w/${m.workspace.slug}/chat/${channelId}`,
          })
        )
    );
  }

  emitToChannel(channelId, EVENTS.CHAT_MESSAGE, { ...message, channelId });
  return json({ message }, 201);
});
