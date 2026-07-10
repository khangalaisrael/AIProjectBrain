"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Boxes, Braces, FileCode2, Folder, FunctionSquare, Globe, Layers } from "lucide-react";

import { type GraphNodeKind } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface AtlasNodeData extends Record<string, unknown> {
  kind: GraphNodeKind;
  label: string;
  description?: string;
  hasChildren: boolean;
  childCount?: number;
  lineCount?: number;
  /** Focus-mode tier: 0 = selected, 1 = connected, 2 = nearby, 3 = everything else. */
  tier: 0 | 1 | 2 | 3;
}

export const ICONS: Record<GraphNodeKind, typeof Folder> = {
  repository: Boxes,
  system: Layers,
  folder: Folder,
  file: FileCode2,
  class: Braces,
  function: FunctionSquare,
  external: Globe,
};

/** Accent per kind — restrained, one hue family plus a muted tone for externals. */
export const TONES: Record<GraphNodeKind, string> = {
  repository: "text-accent",
  system: "text-accent",
  folder: "text-sky-400",
  file: "text-emerald-400",
  class: "text-violet-400",
  function: "text-amber-400",
  external: "text-muted-foreground",
};

const TIER_OPACITY: Record<number, string> = {
  0: "opacity-100",
  1: "opacity-70",
  2: "opacity-40",
  3: "opacity-20",
};

/**
 * A Software Card — a single place on the map. Deliberately not a React Flow
 * default node: no visible handles, no resizer, no toolbar. Icon, title, type
 * and one line of context, readable in under two seconds.
 */
function AtlasNodeComponent({ data, selected }: NodeProps) {
  const { kind, label, description, hasChildren, childCount, lineCount, tier } =
    data as AtlasNodeData;
  const Icon = ICONS[kind];
  const isContainer = kind === "repository" || kind === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
    >
      <div
        className={cn(
          "group rounded-card relative flex h-full w-full items-center gap-3 border px-4 py-3",
          "border-border/70 bg-card/90 shadow-card backdrop-blur-sm",
          // Tailwind v4 has no `--duration-*` theme namespace, so the duration
          // must be a literal utility rather than a token name.
          "ease-out-soft transition-all duration-250",
          "hover:border-border hover:shadow-card-hover hover:-translate-y-0.5",
          TIER_OPACITY[tier ?? 0],
          selected && "border-accent/50 shadow-glow",
          isContainer && "border-border bg-card",
          kind === "external" && "border-dashed",
        )}
      >
        {/* Handles are required for edges to attach, but must never be seen. */}
        <Handle
          type="target"
          position={Position.Left}
          className="!size-0 !border-0 !bg-transparent"
        />

        <span
          className={cn(
            "bg-muted/60 flex shrink-0 items-center justify-center rounded-lg",
            isContainer ? "size-9" : "size-8",
          )}
        >
          <Icon className={cn("size-4", TONES[kind])} />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate leading-tight font-medium",
              isContainer ? "text-sm" : "text-xs",
            )}
          >
            {label}
          </p>
          <p className="text-muted-foreground/80 truncate text-[9px] tracking-wider uppercase">
            {kind}
          </p>
          {description && (
            <p className="text-muted-foreground truncate font-mono text-[10px] leading-tight">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {hasChildren && childCount !== undefined && childCount > 0 && (
            <span className="text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums">
              {childCount}
            </span>
          )}
          {!hasChildren && lineCount !== undefined && lineCount > 0 && (
            <span className="text-muted-foreground/70 text-[9px] tabular-nums">{lineCount} ln</span>
          )}
          {hasChildren && <span className="text-muted-foreground/60 text-[10px]">›</span>}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!size-0 !border-0 !bg-transparent"
        />
      </div>
    </motion.div>
  );
}

export const AtlasNode = memo(AtlasNodeComponent);
