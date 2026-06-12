"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { getInitials } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function ProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Local preview so the new avatar shows immediately after upload.
  const [imageOverride, setImageOverride] = useState<string | null>(null);

  const image = imageOverride ?? user.image;

  async function uploadAvatar(file: File) {
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Avatar must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const { upload, s3Key } = await api<{
        upload: { url: string; fields: Record<string, string> };
        s3Key: string;
      }>("/api/users/me/avatar", {
        method: "POST",
        body: { fileName: file.name, fileType: file.type, fileSize: file.size },
      });

      const formData = new FormData();
      Object.entries(upload.fields).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);
      const s3Res = await fetch(upload.url, { method: "POST", body: formData });
      if (!s3Res.ok) throw new Error("Upload failed");

      const { user: updated } = await api<{ user: { image: string } }>("/api/users/me/avatar", {
        method: "POST",
        body: { confirm: true, s3Key },
      });
      setImageOverride(updated.image);
      toast.success("Avatar updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Avatar upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user.name) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/me", { method: "PATCH", body: { name: trimmed } });
      toast.success("Profile updated");
      router.refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>How teammates see you across workspaces.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <button
            className="group relative rounded-full"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Change avatar"
          >
            <Avatar className="h-20 w-20 text-xl">
              {image && <AvatarImage src={image} alt={user.name} />}
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG or WebP — up to 2 MB</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
          />
        </div>
        <p className="text-xs text-muted-foreground">{user.email}</p>

        <Button
          onClick={saveName}
          loading={saving}
          className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
        >
          Save changes
        </Button>
      </DialogContent>
    </Dialog>
  );
}
