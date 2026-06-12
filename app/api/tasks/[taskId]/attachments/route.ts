import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { requestUploadSchema } from "@/lib/validations";
import { recordActivity } from "@/lib/activity";
import { emitToBoard } from "@/server/emitter";
import { EVENTS } from "@/server/events";
import { withErrorHandling, requireAuth, enforceRateLimit, json, ApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ taskId: string }> };

/**
 * Direct upload: the browser POSTs the file as multipart/form-data and we store the
 * bytes in PostgreSQL (StoredFile), linked one-to-one with the Attachment row.
 */
export const POST = withErrorHandling(async (req: NextRequest, { params }: Params) => {
  const session = await requireAuth();
  await enforceRateLimit(session.userId);
  const { taskId } = await params;
  const { task, workspaceId } = await requireTaskAccess(session.userId, taskId, "MEMBER");

  const form = await req.formData().catch(() => {
    throw new ApiError("Expected multipart form data", 400);
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("No file provided", 400);

  // Same validation rules the client enforces — re-checked server-side.
  const input = requestUploadSchema.parse({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
  const data = Buffer.from(await file.arrayBuffer());

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      uploaderId: session.userId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      file: { create: { data, contentType: input.fileType, size: input.fileSize } },
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
});
