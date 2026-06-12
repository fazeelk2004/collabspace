"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useShell } from "./app-shell";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { OnlineMembers } from "./online-members";

export function Topbar({ menuButton }: { menuButton: React.ReactNode }) {
  const { workspace } = useShell();
  const pathname = usePathname();

  const section = pathname.split("/")[3] ?? "overview";
  const titles: Record<string, string> = {
    overview: "Overview",
    boards: "Board",
    chat: "Chat",
    members: "Members",
    activity: "Activity",
    settings: "Settings",
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md">
      {menuButton}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">
          {workspace.name}
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-muted-foreground">{titles[section] ?? "Overview"}</span>
        </h1>
      </div>
      <button
        className="hidden items-center gap-2 rounded-full border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="rounded border bg-muted px-1 text-[10px]">Ctrl K</kbd>
      </button>
      <OnlineMembers />
      <NotificationDropdown />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
