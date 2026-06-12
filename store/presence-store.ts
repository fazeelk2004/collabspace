"use client";

import { create } from "zustand";

/** Workspace-level presence: which members are currently online. */
type PresenceState = {
  online: Set<string>;
  setOnline: (ids: string[]) => void;
  markOnline: (id: string) => void;
  markOffline: (id: string) => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Set(),
  setOnline: (ids) => set({ online: new Set(ids) }),
  markOnline: (id) =>
    set((s) => {
      const next = new Set(s.online);
      next.add(id);
      return { online: next };
    }),
  markOffline: (id) =>
    set((s) => {
      const next = new Set(s.online);
      next.delete(id);
      return { online: next };
    }),
}));
