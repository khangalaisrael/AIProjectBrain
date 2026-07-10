import { create } from "zustand";

import { type GraphNode } from "@/lib/api";

/** Actions a page can contribute to the palette while it is mounted. */
export interface AtlasPaletteActions {
  nodes: GraphNode[];
  onSelect: (key: string) => void;
}

interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  atlasActions: AtlasPaletteActions | null;
  setAtlasActions: (actions: AtlasPaletteActions | null) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  atlasActions: null,
  setAtlasActions: (atlasActions) => set({ atlasActions }),
}));
