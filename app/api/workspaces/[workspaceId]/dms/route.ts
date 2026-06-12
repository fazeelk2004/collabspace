import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/permissions";
import { createDmSchema } from "@/lib/validations";
import { withErrorHandling, requireAuth, parseBody, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);

  const threads = await prisma.directMessageThread.findMany({
    where: { workspaceId, participants: { some: { userId: session.userId } } },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, createdAt: true, authorId: true, deletedAt: true },
      },
      receipts: { where: { userId: session.userId }, select: { lastReadAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const unread = await Promise.all(
    threads.map((t) =>
      prisma.chatMessage.count({
        where: {
          dmThreadId: t.id,
          deletedAt: null,
          authorId: { not: session.userId },
          createdAt: { gt: t.receipts[0]?.lastReadAt ?? new Date(0) },
        },
      })
    )
  );

  return json({
    threads: threads.map((t, i) => ({
      id: t.id,
      other: t.participants.find((p) => p.userId !== session.userId)?.user ?? null,
      lastMessage: t.messages[0] ?? null,
      unreadCount: unread[i],
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { workspaceId } = await params;
  await requireMembership(session.userId, workspaceId);
  const { userId: otherUserId } = await parseBody(req, createDmSchema);

  if (otherUserId === session.userId) throw new ApiError("Cannot message yourself", 400);
  // The other user must be a member of the same workspace.
  await requireMembership(otherUserId, workspaceId).catch(() => {
    throw new ApiError("User is not a member of this workspace", 404);
  });

  // Reuse an existing thread between these two users if one exists.
  const existing = await prisma.directMessageThread.findFirst({
    where: {
      workspaceId,
      AND: [
        { participants: { some: { userId: session.userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
  });
  if (existing) return json({ thread: existing, existing: true });

  const thread = await prisma.directMessageThread.create({
    data: {
      workspaceId,
      participants: {
        createMany: { data: [{ userId: session.userId }, { userId: otherUserId }] },
      },
    },
  });
  return json({ thread }, 201);
});
