"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  MessageSquare,
  Users,
  History,
  Settings,
  ChevronsUpDown,
  ChevronLeft,
  Plus,
  Check,
  ListTodo,
  CalendarDays,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { can } from "@/lib/permissions-client";
import { useShell } from "./app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { CreateBoardDialog } from "@/components/board/create-board-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { workspace, role, boards, allWorkspaces } = useShell();
  const pathname = usePathname();

  const base = `/w/${workspace.slug}`;
  const nav = [
    { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `${base}/my-tasks`, label: "My tasks", icon: ListTodo },
    { href: `${base}/calendar`, label: "Calendar", icon: CalendarDays },
    { href: `${base}/chat`, label: "Chat", icon: MessageSquare },
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/activity`, label: "Activity", icon: History },
    ...(can.manage(role)
      ? [{ href: `${base}/settings`, label: "Settings", icon: Settings }]
      : []),
  ];

  const NavLink = ({
    href,
    label,
    icon: Icon,
    exact,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
  }) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary"
            : "text-sidebar-foreground/80 hover:bg-accent hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        {active && !collapsed && (
          <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Workspace switcher */}
      <div className="flex items-center gap-1 border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-accent",
                collapsed && "justify-center"
              )}
            >
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                  {getInitials(workspace.name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {workspace.name}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {allWorkspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} asChild>
                <Link href={`/w/${ws.slug}`} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 rounded-md">
                    <AvatarFallback className="rounded-md text-[10px]">
                      {getInitials(ws.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === workspace.id && <Check className="h-4 w-4 text-primary" />}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <CreateWorkspaceDialog>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus /> New workspace
              </DropdownMenuItem>
            </CreateWorkspaceDialog>
          </DropdownMenuContent>
        </DropdownMenu>
        {onToggleCollapse && !collapsed && (
          <Button variant="ghost" size="iconSm" onClick={onToggleCollapse} aria-label="Collapse sidebar">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="space-y-0.5 p-2">
        {nav.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Boards */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!collapsed && (
          <div className="mb-1 flex items-center justify-between px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Boards
            </span>
            {can.manage(role) && (
              <CreateBoardDialog workspaceId={workspace.id} workspaceSlug={workspace.slug}>
                <button
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="New board"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </CreateBoardDialog>
            )}
          </div>
        )}
        <div className="space-y-0.5">
          {boards.map((board) => (
            <NavLink
              key={board.id}
              href={`${base}/boards/${board.id}`}
              label={board.name}
              icon={KanbanSquare}
            />
          ))}
          {boards.length === 0 && !collapsed && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No boards yet</p>
          )}
        </div>
      </div>

      {collapsed && onToggleCollapse && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
