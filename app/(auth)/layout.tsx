import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100">
      <AuroraBackground />
      <Link
        href="/"
        className="relative mb-8 flex animate-in fade-in slide-in-from-bottom-3 items-center gap-2.5 text-lg font-semibold text-white duration-500"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <KanbanSquare className="h-5 w-5 text-white" />
        </span>
        CollabSpace
      </Link>
      <div className="relative w-full max-w-sm">{children}</div>
      <p className="relative mt-8 animate-in fade-in text-center text-xs text-slate-500 duration-700">
        Real-time collaboration for modern teams
      </p>
    </div>
  );
}
