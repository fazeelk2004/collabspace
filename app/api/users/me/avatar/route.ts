import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createUploadUrl, buildAvatarKey, deleteObject, s3Enabled } from "@/lib/s3";
import { withErrorHandling, requireAuth, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

const requestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().refine((t) => AVATAR_TYPES.includes(t), { message: "Use PNG, JPEG or WebP" }),
  fileSize: z.number().int().positive().max(MAX_AVATAR_SIZE, "Avatar must be 2 MB or smaller"),
});

const confirmSchema = z.object({ confirm: z.literal(true), s3Key: z.string().min(1) });

/**
 * Same two-step presigned flow as task attachments:
 *  1. request → presigned S3 POST
 *  2. confirm → point user.image at the redirecting avatar endpoint
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  if (!s3Enabled()) throw new ApiError("File uploads are not configured", 503);

  const raw = await req.json().catch(() => {
    throw new ApiError("Invalid JSON body", 400);
  });

  if (raw && typeof raw === "object" && "confirm" in raw) {
    const { s3Key } = confirmSchema.parse(raw);
    if (!s3Key.startsWith(`avatars/${session.userId}/`)) {
      throw new ApiError("Invalid avatar key", 400);
    }

    // Clean up the previous avatar object, then swap the pointer.
    const previous = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { avatarKey: true },
    });
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        avatarKey: s3Key,
        image: `/api/users/${session.userId}/avatar?v=${Date.now()}`,
      },
      select: { id: true, name: true, email: true, image: true },
    });
    if (previous?.avatarKey) await deleteObject(previous.avatarKey).catch(() => {});
    return json({ user });
  }

  const input = requestSchema.parse(raw);
  const key = buildAvatarKey(session.userId, input.fileName);
  const presigned = await createUploadUrl(key, input.fileType);
  return json({ upload: presigned, s3Key: key });
});
