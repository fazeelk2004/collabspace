import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { createChannelSchema } from "@/lib/validations";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const channels = await prisma.chatChannel.findMany({
    where: { workspaceId },
    include: {
      board: { select: { id: true, name: true, visibility: true, createdById: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true },
      },
      receipts: { where: { userId: session.userId }, select: { lastReadAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Compute unread counts per channel in one query.
  const unread = await Promise.all(
    channels.map((c) =>
      prisma.chatMessage.count({
        where: {
          channelId: c.id,
          deletedAt: null,
          authorId: { not: session.userId },
          createdAt: { gt: c.receipts[0]?.lastReadAt ?? new Date(0) },
        },
      })
    )
  );

  return json({
    channels: channels.map((c, i) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      boardId: c.boardId,
      lastMessageAt: c.messages[0]?.createdAt ?? null,
      unreadCount: unread[i],
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId, "ADMIN");
  const { name } = await parseBody(req, createChannelSchema);

  const existing = await prisma.chatChannel.findFirst({
    where: { workspaceId, name, type: "WORKSPACE" },
  });
  if (existing) throw new ApiError("A channel with this name already exists", 409);

  const channel = await prisma.chatChannel.create({
    data: { workspaceId, name, type: "WORKSPACE" },
  });
  return json({ channel }, 201);
});
