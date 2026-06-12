"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations";
import { api, FetchError } from "@/lib/fetcher";
import { useShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteMemberDialog({
  children,
  onInvited,
}: {
  children: React.ReactNode;
  onInvited?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const { workspace } = useShell();

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  async function onSubmit(values: InviteMemberInput) {
    try {
      const res = await api<{ inviteUrl: string }>(
        `/api/workspaces/${workspace.id}/invitations`,
        { method: "POST", body: values }
      );
      setInviteUrl(res.inviteUrl);
      toast.success(`Invitation created for ${values.email}`);
      onInvited?.();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Invitation failed");
    }
  }

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setInviteUrl(null);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll join <strong>{workspace.name}</strong> with the role you pick.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link — it&apos;s valid for 7 days and tied to the invited email:
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success("Link copied");
                }}
                aria-label="Copy invite link"
              >
                <Copy />
              </Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setInviteUrl(null)}>
              Invite another person
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                autoFocus
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as InviteMemberInput["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin — manage boards & members</SelectItem>
                  <SelectItem value="MEMBER">Member — create & edit tasks</SelectItem>
                  <SelectItem value="VIEWER">Viewer — read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Create invitation
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
