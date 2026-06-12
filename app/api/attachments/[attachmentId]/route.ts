import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess, can, PermissionError } from "@/lib/permissions";
import { createDownloadUrl, deleteObject, s3Enabled } from "@/lib/s3";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ attachmentId: string }> };

async function loadAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new ApiError("Attachment not found", 404);
  return attachment;
}

/** Redirect to a short-lived signed S3 URL — membership is checked first. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { attachmentId } = await params;
  const attachment = await loadAttachment(attachmentId);
  await requireTaskAccess(session.userId, attachment.taskId);

  if (!s3Enabled()) throw new ApiError("File downloads are not configured", 503);
  const url = await createDownloadUrl(attachment.s3Key, attachment.fileName);
  return NextResponse.redirect(url);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { attachmentId } = await params;
  const attachment = await loadAttachment(attachmentId);
  const { membership } = await requireTaskAccess(session.userId, attachment.taskId, "MEMBER");

  if (attachment.uploaderId !== session.userId && !can.manage(membership.role)) {
    throw new PermissionError("You can only delete your own attachments");
  }

  await prisma.attachment.delete({ where: { id: attachmentId } });
  if (s3Enabled()) await deleteObject(attachment.s3Key).catch(() => {});
  return json({ ok: true });
});
