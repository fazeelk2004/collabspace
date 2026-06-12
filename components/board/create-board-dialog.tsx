"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KanbanSquare, Zap, Bug, Map } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { BOARD_TEMPLATES, type BoardTemplate } from "@/lib/validations";
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

const TEMPLATE_META: Record<BoardTemplate, { icon: typeof Zap; accent: string }> = {
  blank: { icon: KanbanSquare, accent: "from-slate-500 to-slate-600" },
  sprint: { icon: Zap, accent: "from-indigo-500 to-violet-600" },
  bugs: { icon: Bug, accent: "from-rose-500 to-pink-600" },
  roadmap: { icon: Map, accent: "from-emerald-500 to-teal-600" },
};

export function CreateBoardDialog({
  workspaceId,
  workspaceSlug,
  children,
}: {
  workspaceId: string;
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<BoardTemplate>("blank");
  const [creating, setCreating] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const { board } = await api<{ board: { id: string } }>(
        `/api/workspaces/${workspaceId}/boards`,
        { method: "POST", body: { name: trimmed, visibility: "WORKSPACE", template } }
      );
      setOpen(false);
      setName("");
      setTemplate("blank");
      router.push(`/w/${workspaceSlug}/boards/${board.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Could not create board");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>Pick a template to start with ready-made columns.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="board-name">Board name</Label>
          <Input
            id="board-name"
            autoFocus
            value={name}
            placeholder="Product launch"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(BOARD_TEMPLATES) as BoardTemplate[]).map((key) => {
            const meta = TEMPLATE_META[key];
            const selected = template === key;
            return (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  selected
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                    : "hover:border-primary/30 hover:bg-accent/40"
                )}
              >
                <span
                  className={cn(
                    "mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow",
                    meta.accent
                  )}
                >
                  <meta.icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium">{BOARD_TEMPLATES[key].label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {BOARD_TEMPLATES[key].columns.join(" · ")}
                </p>
              </button>
            );
          })}
        </div>

        <Button
          onClick={create}
          loading={creating}
          disabled={!name.trim()}
          className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
        >
          Create board
        </Button>
      </DialogContent>
    </Dialog>
  );
}
