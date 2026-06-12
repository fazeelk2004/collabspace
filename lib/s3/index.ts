import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_FILE_SIZE } from "@/lib/validations";

// On ECS the SDK picks up credentials from the task IAM role automatically;
// explicit keys are only needed for local development.
let _client: S3Client | null = null;

function s3(): S3Client {
  if (!_client) {
    _client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return _client;
}

export function s3Enabled(): boolean {
  return process.env.S3_DISABLED !== "1" && !!process.env.S3_BUCKET_NAME;
}

function bucket(): string {
  const name = process.env.S3_BUCKET_NAME;
  if (!name) throw new Error("S3_BUCKET_NAME is not configured");
  return name;
}

/** Presigned POST so the browser uploads directly to S3 — bytes never pass through the app. */
export async function createUploadUrl(key: string, fileType: string) {
  return createPresignedPost(s3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", fileType],
    ],
    Fields: { "Content-Type": fileType },
    Expires: 300, // 5 minutes
  });
}

/** Short-lived signed GET URL for private downloads. */
export async function createDownloadUrl(key: string, fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return getSignedUrl(s3(), command, { expiresIn: 300 });
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export function buildAttachmentKey(workspaceId: string, taskId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `workspaces/${workspaceId}/tasks/${taskId}/${Date.now()}-${safe}`;
}

export function buildAvatarKey(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `avatars/${userId}/${Date.now()}-${safe}`;
}

/** Inline (non-download) signed URL, used for avatar redirects. */
export async function createViewUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(s3(), command, { expiresIn: 3600 });
}
