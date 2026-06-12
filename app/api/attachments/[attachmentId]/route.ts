import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess, can, PermissionError } from "@/lib/permissions";
import { withErrorHandling, requireAuth, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ attachmentId: string }> };

async function loadAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new ApiError("Attachment not found", 404);
  return attachment;
}

/** Stream the attachment bytes from PostgreSQL — membership is checked first. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { attachmentId } = await params;
  const attachment = await loadAttachment(attachmentId);
  await requireTaskAccess(session.userId, attachment.taskId);

  const file = await prisma.storedFile.findUnique({ where: { attachmentId } });
  if (!file) throw new ApiError("File data not found", 404);

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    },
  });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  const { attachmentId } = await params;
  const attachment = await loadAttachment(attachmentId);
  const { membership } = await requireTaskAccess(session.userId, attachment.taskId, "MEMBER");

  if (attachment.uploaderId !== session.userId && !can.manage(membership.role)) {
    throw new PermissionError("You can only delete your own attachments");
  }

  // Deleting the attachment cascade-deletes its StoredFile (FK onDelete: Cascade).
  await prisma.attachment.delete({ where: { id: attachmentId } });
  return json({ ok: true });
});
