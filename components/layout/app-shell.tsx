"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import type { Role, SessionUser } from "@/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { PresenceListener } from "./presence-listener";
import { CommandPalette } from "./command-palette";

export type ShellContextValue = {
  user: SessionUser;
  workspace: { id: string; name: string; slug: string; imageUrl: string | null };
  role: Role;
  boards: { id: string; name: string }[];
  allWorkspaces: { id: string; name: string; slug: string }[];
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}

export function AppShell({
  children,
  ...ctx
}: ShellContextValue & { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const pathname = usePathname();

  return (
    <ShellContext.Provider value={ctx}>
      <PresenceListener workspaceId={ctx.workspace.id} />
      <CommandPalette />
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar with animated collapse */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 64 : 256 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="hidden h-full shrink-0 border-r bg-sidebar md:block"
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        </motion.aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar md:hidden"
              >
                <Sidebar collapsed={false} onNavigate={() => setSidebarOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            menuButton={
              <button
                className="rounded-md p-2 hover:bg-accent md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            }
          />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex h-full min-h-full flex-col"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
