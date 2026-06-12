import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withErrorHandling, requireAuth, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Direct avatar upload: the browser POSTs the image as multipart/form-data and we
 * store the bytes in PostgreSQL (StoredFile). `user.image` points at the avatar
 * endpoint, which streams those bytes back. No S3, no presigned URLs.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);

  const form = await req.formData().catch(() => {
    throw new ApiError("Expected multipart form data", 400);
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("No file provided", 400);
  if (!AVATAR_TYPES.includes(file.type)) throw new ApiError("Use PNG, JPEG or WebP", 400);
  if (file.size > MAX_AVATAR_SIZE) throw new ApiError("Avatar must be 2 MB or smaller", 400);

  const data = Buffer.from(await file.arrayBuffer());

  // Replace any existing avatar blob, then point the user's image at the
  // redirect-free avatar endpoint with a cache-busting version.
  const image = `/api/users/${session.userId}/avatar?v=${Date.now()}`;
  const [, , user] = await prisma.$transaction([
    prisma.storedFile.deleteMany({ where: { avatarUserId: session.userId } }),
    prisma.storedFile.create({
      data: { avatarUserId: session.userId, data, contentType: file.type, size: file.size },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { image },
      select: { id: true, name: true, email: true, image: true },
    }),
  ]);

  return json({ user });
});
