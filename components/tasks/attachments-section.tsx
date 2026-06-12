"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Download, Trash2, UploadCloud } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/validations";
import type { Attachment, TaskDetail } from "@/types";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ taskId, canUpload }: { taskId: string; canUpload: boolean }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api<{ task: TaskDetail }>(`/api/tasks/${taskId}`),
  });
  const attachments = data?.task.attachments ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["task", taskId] });

  async function upload(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("This file type is not allowed");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 10 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      // Upload the bytes straight to our API, which stores them in PostgreSQL.
      const formData = new FormData();
      formData.append("file", file);
      await api(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      toast.success("File uploaded");
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(attachment: Attachment) {
    try {
      await api(`/api/attachments/${attachment.id}`, { method: "DELETE" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button
            variant="outline"
            className="w-full border-dashed"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud /> Upload a file (max 10 MB)
          </Button>
        </>
      )}

      <AnimatePresence initial={false}>
        {attachments.map((att) => (
          <motion.div
            key={att.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="group flex items-center gap-3 rounded-lg border p-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              {att.fileType.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{att.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(att.fileSize)} · {att.uploader?.name ?? "Unknown"} ·{" "}
                {formatDistanceToNow(new Date(att.createdAt), { addSuffix: true })}
              </p>
            </div>
            <a
              href={`/api/attachments/${att.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Download ${att.fileName}`}
            >
              <Download className="h-4 w-4" />
            </a>
            {canUpload && (
              <button
                className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
                onClick={() => remove(att)}
                aria-label={`Delete ${att.fileName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {attachments.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">No files attached.</p>
      )}
    </div>
  );
}
