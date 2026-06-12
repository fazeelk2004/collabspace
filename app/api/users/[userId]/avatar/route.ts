import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createViewUrl, s3Enabled } from "@/lib/s3";
import { withErrorHandling, requireAuth, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ userId: string }> };

/** Redirect to a short-lived signed URL for the user's avatar. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  await requireAuth();
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarKey: true },
  });
  if (!user?.avatarKey || !s3Enabled()) throw new ApiError("No avatar", 404);

  const url = await createViewUrl(user.avatarKey);
  return NextResponse.redirect(url, {
    // Cache briefly in the browser so avatar grids don't hammer the redirect.
    headers: { "Cache-Control": "private, max-age=300" },
  });
});
