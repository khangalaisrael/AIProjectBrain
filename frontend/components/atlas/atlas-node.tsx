"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Boxes, Braces, FileCode2, Folder, FunctionSquare, Globe, Layers } from "lucide-react";

import { type GraphNodeKind } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface AtlasNodeData extends Record<string, unknown> {
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  selected?: boolean;
  hasChildren: boolean;
}

const ICONS: Record<GraphNodeKind, typeof Folder> = {
  repository: Boxes,
  system: Layers,
  folder: Folder,
  file: FileCode2,
  class: Braces,
  function: FunctionSquare,
  external: Globe,
};

/** Accent per kind — restrained, one hue family plus a muted tone for externals. */
const TONES: Record<GraphNodeKind, string> = {
  repository: "text-accent",
  system: "text-accent",
  folder: "text-sky-400",
  file: "text-emerald-400",
  class: "text-violet-400",
  function: "text-amber-400",
  external: "text-muted-foreground",
};

/**
 * A single place on the map. Deliberately not a React Flow default node:
 * no visible handles, no resizer, no toolbar — just a quiet card.
 */
function AtlasNodeComponent({ data }: NodeProps) {
  const { kind, label, sublabel, hasChildren } = data as AtlasNodeData;
  const Icon = ICONS[kind];
  const isContainer = kind === "repository" || kind === "system";

  return (
    <div
      className={cn(
        "group relative flex h-full w-full items-center gap-3 rounded-xl border px-4 transition-all",
        "border-border/70 bg-card/80 backdrop-blur-sm",
        "hover:border-accent/60 hover:bg-card",
        isContainer && "border-border bg-card shadow-lg",
        kind === "external" && "border-dashed opacity-70",
      )}
    >
      {/* Handles are required for edges to attach, but must never be seen. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-0 !border-0 !bg-transparent"
      />

      <Icon className={cn("size-4 shrink-0", TONES[kind])} />

      <div className="min-w-0 flex-1">
        <p
          className={cn("truncate leading-tight font-medium", isContainer ? "text-sm" : "text-xs")}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-muted-foreground truncate text-[10px] leading-tight">{sublabel}</p>
        )}
      </div>

      {hasChildren && (
        <span className="text-muted-foreground/60 shrink-0 text-[10px] tabular-nums">›</span>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const AtlasNode = memo(AtlasNodeComponent);
