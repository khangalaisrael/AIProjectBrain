"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

import { type GraphNode } from "@/lib/api";
import { navItems } from "@/lib/nav";
import { useCommandPaletteStore } from "@/lib/command-palette-store";
import { ICONS, TONES } from "@/components/atlas/atlas-node";
import { cn } from "@/lib/utils";

const MAX_NODE_RESULTS = 12;

interface PaletteItem {
  id: string;
  group: "Pages" | "Atlas";
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTone?: string;
  run: () => void;
}

/**
 * The global Ctrl+K command palette. Plain React on purpose — a fixed overlay,
 * one input, grouped results, full keyboard control. No extra dependencies.
 */
export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, toggle, atlasActions } = useCommandPaletteStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Global shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const pages: PaletteItem[] = navItems
      .filter((item) => !q || item.label.toLowerCase().includes(q))
      .map((item) => ({
        id: `page-${item.href}`,
        group: "Pages",
        label: item.label,
        icon: item.icon,
        run: () => {
          close();
          router.push(item.href);
        },
      }));

    const nodes: PaletteItem[] = (atlasActions && q ? atlasActions.nodes : [])
      .filter(
        (n: GraphNode) =>
          n.name.toLowerCase().includes(q) || (n.path ?? "").toLowerCase().includes(q),
      )
      .slice(0, MAX_NODE_RESULTS)
      .map((n) => ({
        id: `node-${n.key}`,
        group: "Atlas" as const,
        label: n.name,
        hint: n.path ? `${n.kind} · ${n.path}` : n.kind,
        icon: ICONS[n.kind],
        iconTone: TONES[n.kind],
        run: () => {
          close();
          atlasActions!.onSelect(n.key);
        },
      }));

    return [...nodes, ...(q && nodes.length > 0 ? pages.slice(0, 3) : pages)];
  }, [query, atlasActions, router, close]);

  useEffect(() => setActiveIndex(0), [items.length, query]);

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  // Keep the active row visible.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let lastGroup: string | null = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-background/60 fixed inset-0 z-50 flex items-start justify-center pt-[18vh] backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="border-border/70 bg-card rounded-card shadow-card-hover w-full max-w-lg overflow-hidden border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-border flex items-center gap-2 border-b px-4">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={atlasActions ? "Search pages and the map…" : "Search pages…"}
                className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
              />
              <kbd className="border-border text-muted-foreground rounded border px-1.5 text-[10px]">
                Esc
              </kbd>
            </div>

            <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 && (
                <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                  Nothing matches.
                </li>
              )}
              {items.map((item, index) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    {showGroup && (
                      <p className="text-muted-foreground/70 px-3 pt-2 pb-1 text-[10px] font-medium tracking-wider uppercase">
                        {item.group}
                      </p>
                    )}
                    <button
                      data-index={index}
                      onClick={item.run}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        index === activeIndex ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <Icon
                        className={cn("size-4 shrink-0", item.iconTone ?? "text-muted-foreground")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{item.label}</span>
                        {item.hint && (
                          <span className="text-muted-foreground block truncate text-[10px]">
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
