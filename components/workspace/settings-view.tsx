"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileDown, History } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { can } from "@/lib/permissions-client";
import { useShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsView() {
  const { workspace, role } = useShell();
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function rename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) return;
    setSaving(true);
    try {
      await api(`/api/workspaces/${workspace.id}`, { method: "PATCH", body: { name: trimmed } });
      toast.success("Workspace renamed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace() {
    setDeleting(true);
    try {
      await api(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
      toast.success("Workspace deleted");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Workspace settings</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage {workspace.name} — slug: <code className="text-xs">{workspace.slug}</code>
        </p>
      </div>

      <Card className="dark:border-white/[0.08] dark:bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Rename your workspace. The URL slug stays stable.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={rename} loading={saving} disabled={name.trim() === workspace.name}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:border-white/[0.08] dark:bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Export data</CardTitle>
          <CardDescription>
            Download workspace data as CSV — open it in Excel or Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href={`/api/workspaces/${workspace.id}/export?type=tasks`} download>
              <FileDown /> Export tasks
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/workspaces/${workspace.id}/export?type=activity`} download>
              <History /> Export activity log
            </a>
          </Button>
        </CardContent>
      </Card>

      {can.own(role) && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
            <CardDescription>
              Deleting a workspace permanently removes all boards, tasks, chat history and files.
              This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <strong>{workspace.name}</strong> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={workspace.name}
              />
            </div>
            <Button
              variant="destructive"
              disabled={confirmText !== workspace.name}
              loading={deleting}
              onClick={deleteWorkspace}
            >
              Delete this workspace
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
