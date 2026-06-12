import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireDmAccess } from "@/lib/permissions";
import { emitToDm } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

type Params = { params: Promise<{ threadId: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { threadId } = await params;
  await requireDmAccess(session.userId, threadId);

  const now = new Date();
  await prisma.chatReadReceipt.upsert({
    where: { dmThreadId_userId: { dmThreadId: threadId, userId: session.userId } },
    create: { dmThreadId: threadId, userId: session.userId, lastReadAt: now },
    update: { lastReadAt: now },
  });

  emitToDm(threadId, EVENTS.CHAT_READ, { dmThreadId: threadId, userId: session.userId, lastReadAt: now });
  return json({ ok: true });
});
