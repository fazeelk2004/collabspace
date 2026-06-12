import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireChannelAccess, requireDmAccess } from "@/lib/permissions";
import { reactionSchema } from "@/lib/validations";
import { emitToChannel, emitToDm } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ messageId: string }> };

/** Toggle a reaction: adds it if missing, removes it if present. */
export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId, "chat");
  const { messageId } = await params;
  const { emoji } = await parseBody(req, reactionSchema);

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new ApiError("Message not found", 404);

  if (message.channelId) await requireChannelAccess(session.userId, message.channelId);
  else if (message.dmThreadId) await requireDmAccess(session.userId, message.dmThreadId);

  const existing = await prisma.chatMessageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: session.userId, emoji } },
  });

  let op: "add" | "remove";
  if (existing) {
    await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
    op = "remove";
  } else {
    await prisma.chatMessageReaction.create({
      data: { messageId, userId: session.userId, emoji },
    });
    op = "add";
  }

  const payload = { messageId, emoji, userId: session.userId, op };
  if (message.channelId) emitToChannel(message.channelId, EVENTS.CHAT_REACTION, payload);
  else if (message.dmThreadId) emitToDm(message.dmThreadId, EVENTS.CHAT_REACTION, payload);

  return json({ op });
});
