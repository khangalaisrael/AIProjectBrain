"use client";

import { Menu, PanelLeft, Search } from "lucide-react";

import { AuthControls } from "@/components/auth/auth-controls";
import { Button } from "@/components/ui/button";
import { useCommandPaletteStore } from "@/lib/command-palette-store";

interface TopNavProps {
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
}

export function TopNav({ onToggleSidebar, onOpenMenu }: TopNavProps) {
  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-4 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="lg:hidden"
      >
        <Menu className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden lg:inline-flex"
      >
        <PanelLeft className="size-4" />
      </Button>

      <button
        type="button"
        onClick={() => useCommandPaletteStore.getState().setOpen(true)}
        className="border-border bg-muted/40 text-muted-foreground hover:bg-muted flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-sm transition-colors sm:max-w-sm"
      >
        <Search className="size-4" />
        <span>Search…</span>
        <kbd className="border-border ml-auto hidden rounded border px-1.5 text-xs sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto shrink-0">
        <AuthControls />
      </div>
    </header>
  );
}
