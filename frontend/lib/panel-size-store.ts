"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Stable ids for every resizable panel in the app. */
export const PANEL = {
  explorerTree: "explorer.tree",
  explorerAside: "explorer.aside",
  learnNav: "learn.nav",
  chatDock: "chat.dock",
  atlasDetails: "atlas.details",
} as const;

interface PanelSizeState {
  widths: Record<string, number>;
  /** True once localStorage has rehydrated — guards against SSR mismatch. */
  hydrated: boolean;
  setWidth: (id: string, width: number) => void;
  resetWidth: (id: string) => void;
  setHydrated: () => void;
}

export const usePanelSizeStore = create<PanelSizeState>()(
  persist(
    (set) => ({
      widths: {},
      hydrated: false,
      setWidth: (id, width) => set((state) => ({ widths: { ...state.widths, [id]: width } })),
      resetWidth: (id) =>
        set((state) => {
          const widths = { ...state.widths };
          delete widths[id];
          return { widths };
        }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "brain-panel-sizes",
      partialize: (state) => ({ widths: state.widths }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
