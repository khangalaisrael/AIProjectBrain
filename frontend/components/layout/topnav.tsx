"use client";

import { PanelLeft, Search } from "lucide-react";

import { AuthControls } from "@/components/auth/auth-controls";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  onToggleSidebar: () => void;
}

export function TopNav({ onToggleSidebar }: TopNavProps) {
  return (
    <header className="border-border flex h-14 items-center gap-4 border-b px-4">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <PanelLeft className="size-4" />
      </Button>

      <button
        type="button"
        className="border-border bg-muted/40 text-muted-foreground hover:bg-muted flex h-9 w-full max-w-sm items-center gap-2 rounded-md border px-3 text-sm transition-colors"
      >
        <Search className="size-4" />
        <span>Search…</span>
        <kbd className="border-border ml-auto rounded border px-1.5 text-xs">Ctrl K</kbd>
      </button>

      <div className="ml-auto">
        <AuthControls />
      </div>
    </header>
  );
}
