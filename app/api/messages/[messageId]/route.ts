import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  requireChannelAccess,
  requireDmAccess,
  can,
  PermissionError,
} from "@/lib/permissions";
import { chatMessageSchema } from "@/lib/validations";
import { emitToChannel, emitToDm } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ messageId: string }> };

async function loadMessage(messageId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new ApiError("Message not found", 404);
  return message;
}

/** Verify room access for a message in either a channel or a DM thread. */
async function checkRoomAccess(userId: string, message: { channelId: string | null; dmThreadId: string | null }) {
  if (message.channelId) {
    return { ...(await requireChannelAccess(userId, message.channelId)), isDm: false };
  }
  if (message.dmThreadId) {
    return { ...(await requireDmAccess(userId, message.dmThreadId)), membership: null, isDm: true };
  }
  throw new ApiError("Message has no room", 500);
}

function broadcast(message: { channelId: string | null; dmThreadId: string | null }, event: Parameters<typeof emitToChannel>[1], payload: unknown) {
  if (message.channelId) emitToChannel(message.channelId, event, payload);
  else if (message.dmThreadId) emitToDm(message.dmThreadId, event, payload);
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId, "chat");
  const { messageId } = await params;
  const message = await loadMessage(messageId);
  await checkRoomAccess(session.userId, message);

  if (message.authorId !== session.userId) {
    throw new PermissionError("You can only edit your own messages");
  }

  const { body } = await parseBody(req, chatMessageSchema);
  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
    include: {
      author: { select: { id: true, name: true, image: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  broadcast(message, EVENTS.CHAT_MESSAGE_UPDATED, updated);
  return json({ message: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { messageId } = await params;
  const message = await loadMessage(messageId);
  const access = await checkRoomAccess(session.userId, message);

  const isAuthor = message.authorId === session.userId;
  const isModerator = !access.isDm && access.membership && can.manage(access.membership.role);
  if (!isAuthor && !isModerator) {
    throw new PermissionError("You can only delete your own messages");
  }

  // Soft delete keeps thread continuity ("message deleted" placeholder).
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: "" },
  });

  broadcast(message, EVENTS.CHAT_MESSAGE_DELETED, {
    messageId,
    channelId: message.channelId,
    dmThreadId: message.dmThreadId,
  });
  return json({ ok: true });
});
