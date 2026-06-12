import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: { select: { id: true, name: true, image: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.notification.count({ where: { recipientId: session.userId, read: false } }),
  ]);
  return json({ notifications, unreadCount });
});
