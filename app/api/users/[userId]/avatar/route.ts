import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withErrorHandling, requireAuth, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ userId: string }> };

/** Stream the user's avatar bytes straight from PostgreSQL. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  await requireAuth();
  const { userId } = await params;

  const file = await prisma.storedFile.findUnique({ where: { avatarUserId: userId } });
  if (!file) throw new ApiError("No avatar", 404);

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      // Cache briefly in the browser so avatar grids don't hammer the endpoint.
      "Cache-Control": "private, max-age=300",
    },
  });
});
