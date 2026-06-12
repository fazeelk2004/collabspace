"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validations";
import { api, FetchError } from "@/lib/fetcher";
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

export function CreateWorkspaceDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateWorkspaceInput) {
    try {
      const { workspace } = await api<{ workspace: { slug: string } }>("/api/workspaces", {
        method: "POST",
        body: values,
      });
      toast.success("Workspace created");
      setOpen(false);
      router.push(`/w/${workspace.slug}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>
            A workspace contains boards, chat channels and your team. You&apos;ll be the owner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" placeholder="Acme Inc." autoFocus {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Create workspace
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
