import { prisma } from "@/lib/db/prisma";
import { withErrorHandling, requireAuth, json } from "@/lib/api-utils";

export const POST = withErrorHandling(async () => {
  const session = await requireAuth();
  await prisma.notification.updateMany({
    where: { recipientId: session.userId, read: false },
    data: { read: true },
  });
  return json({ ok: true });
});
