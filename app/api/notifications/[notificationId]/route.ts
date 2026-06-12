import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ notificationId: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { notificationId } = await params;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  // Recipients can only touch their own notifications.
  if (!notification || notification.recipientId !== session.userId) {
    throw new ApiError("Notification not found", 404);
  }

  const body = (await req.json().catch(() => ({}))) as { read?: boolean };
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: body.read ?? true },
  });
  return json({ notification: updated });
});
