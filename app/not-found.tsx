"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Compass } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default function NotFound() {
  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-slate-950 px-4 text-center text-slate-100">
      <AuroraBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative"
      >
        <p className="gradient-text text-[8rem] font-bold leading-none tracking-tight sm:text-[11rem]">
          404
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative flex flex-col items-center gap-4"
      >
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Compass className="h-5 w-5 text-indigo-400" />
          This page doesn&apos;t exist
        </h1>
        <p className="max-w-sm text-sm text-slate-400">
          The page may have been deleted, or you might not have access to this workspace.
        </p>
        <Link
          href="/dashboard"
          className="group mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to your workspaces
        </Link>
      </motion.div>
    </div>
  );
}
