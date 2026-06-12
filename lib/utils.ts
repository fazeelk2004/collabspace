import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a URL-safe slug from a name, with a short random suffix for uniqueness. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Extract @mentions from text. Matches @[Name](userId) tokens produced by the mention composer. */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  const re = /@\[[^\]]+\]\(([a-z0-9]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) ids.add(m[1]);
  return [...ids];
}

/** Render mention tokens back to plain @Name text for display fallbacks. */
export function renderMentionsPlain(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([a-z0-9]+\)/gi, "@$1");
}

export const PRIORITY_META = {
  LOW: { label: "Low", color: "#64748b" },
  MEDIUM: { label: "Medium", color: "#3b82f6" },
  HIGH: { label: "High", color: "#f59e0b" },
  URGENT: { label: "Urgent", color: "#ef4444" },
} as const;

export type PriorityKey = keyof typeof PRIORITY_META;
