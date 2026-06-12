import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { requestUploadSchema } from "@/lib/validations";
import { createUploadUrl, buildAttachmentKey, s3Enabled } from "@/lib/s3";
import { recordActivity } from "@/lib/activity";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

/**
 * Two-step upload:
 *  1. POST with {fileName,fileType,fileSize} → presigned S3 POST (browser uploads directly)
 *  2. POST with {confirm:true, s3Key, ...}   → persist metadata after the upload succeeded
 */
const confirmSchema = requestUploadSchema.extend({
  confirm: z.literal(true),
  s3Key: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");

  if (!s3Enabled()) throw new ApiError("File uploads are not configured", 503);

  const raw = await req.json().catch(() => {
    throw new ApiError("Invalid JSON body", 400);
  });

  // Step 2: confirm — persist metadata.
  if (raw && typeof raw === "object" && "confirm" in raw) {
    const input = confirmSchema.parse(raw);
    // The key must match the prefix issued for this task — clients can't
    // register attachments pointing at other workspaces' files.
    const expectedPrefix = `workspaces/${workspaceId}/tasks/${taskId}/`;
    if (!input.s3Key.startsWith(expectedPrefix)) {
      throw new ApiError("Invalid attachment key", 400);
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploaderId: session.userId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        s3Key: input.s3Key,
      },
      include: { uploader: { select: { id: true, name: true, image: true } } },
    });

    await recordActivity({
      workspaceId,
      actorId: session.userId,
      boardId: task.boardId,
      taskId,
      type: "ATTACHMENT_ADDED",
      meta: { fileName: input.fileName, title: task.title },
    });
    emitToBoard(task.boardId, EVENTS.TASK_UPDATED, { taskId, attachmentAdded: attachment });
    return json({ attachment }, 201);
  }

  // Step 1: request a presigned upload.
  const input = requestUploadSchema.parse(raw);
  const key = buildAttachmentKey(workspaceId, taskId, input.fileName);
  const presigned = await createUploadUrl(key, input.fileType);
  return json({ upload: presigned, s3Key: key });
});
