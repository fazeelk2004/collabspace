import { cn } from "@/lib/utils";

/**
 * Landing-theme backdrop: faint grid + drifting indigo/violet orbs.
 * Pure CSS animations so it can be rendered from server components.
 * Parent must be `relative` and content should sit above with `relative`.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="grid-overlay absolute inset-0" />
      <div className="orb orb-a -top-32 left-1/4 h-[480px] w-[480px] bg-indigo-600/25" />
      <div className="orb orb-b -top-16 right-1/5 h-[420px] w-[420px] bg-violet-600/20" />
      <div className="orb orb-a left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 bg-fuchsia-600/10" />
    </div>
  );
}
