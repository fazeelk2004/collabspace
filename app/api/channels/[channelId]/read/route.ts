import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireChannelAccess } from "@/lib/permissions";
import { emitToChannel } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ channelId: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { channelId } = await params;
  await requireChannelAccess(session.userId, channelId);

  const now = new Date();
  await prisma.chatReadReceipt.upsert({
    where: { channelId_userId: { channelId, userId: session.userId } },
    create: { channelId, userId: session.userId, lastReadAt: now },
    update: { lastReadAt: now },
  });

  emitToChannel(channelId, EVENTS.CHAT_READ, {
    channelId,
    userId: session.userId,
    lastReadAt: now,
  });
  return json({ ok: true });
});
