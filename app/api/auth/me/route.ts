import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { updateProfileSchema } from "@/lib/validations";
import { withErrorHandling, requireAuth, parseBody, json, ApiError } from "@/lib/api-utils";

export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, image: true, createdAt: true },
  });
  if (!user) throw new ApiError("User not found", 404);
  return json({ user });
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const data = await parseBody(req, updateProfileSchema);
  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { id: true, email: true, name: true, image: true },
  });
  return json({ user });
});
