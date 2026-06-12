"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { KanbanSquare, Users, LayoutGrid, Plus, ArrowRight } from "lucide-react";
import type { WorkspaceSummary } from "@/types";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

const avatarGradients = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-fuchsia-600",
];

export function WorkspaceHub({
  user,
  workspaces,
}: {
  user: { id: string; name: string };
  workspaces: WorkspaceSummary[];
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="hidden dark:block">
        <AuroraBackground />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-20">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome{workspaces.length ? " back" : ""},{" "}
            <span className="gradient-text">{user.name.split(" ")[0]}</span> 👋
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {workspaces.length
              ? "Pick a workspace to continue, or create a new one."
              : "Create your first workspace to start collaborating."}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 1}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <Link
                href={`/w/${ws.slug}`}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:backdrop-blur dark:hover:border-white/[0.18]"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20" />
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-base font-semibold text-white shadow-lg ${avatarGradients[i % avatarGradients.length]}`}
                >
                  {getInitials(ws.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{ws.name}</span>
                    <Badge variant="secondary" className="capitalize">
                      {ws.role.toLowerCase()}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {ws._count.members}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <LayoutGrid className="h-3 w-3" /> {ws._count.boards} boards
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            </motion.div>
          ))}

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={workspaces.length + 1}
          >
            <CreateWorkspaceDialog>
              <button className="flex h-full min-h-[5.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary dark:border-white/15 dark:hover:border-indigo-400/50 dark:hover:bg-indigo-500/5 dark:hover:text-indigo-300">
                <Plus className="h-5 w-5" />
                New workspace
              </button>
            </CreateWorkspaceDialog>
          </motion.div>
        </div>

        {workspaces.length === 0 && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="mt-16 flex flex-col items-center text-center text-muted-foreground"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15">
              <KanbanSquare className="h-7 w-7 text-indigo-400" />
            </span>
            <p className="text-sm">A workspace holds your boards, chat channels and teammates.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
