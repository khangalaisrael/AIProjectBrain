"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { FunctionSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export type FlowNodeState = "visited" | "active" | "future";

export interface FlowNodeData extends Record<string, unknown> {
  index: number;
  name: string;
  file: string;
  state: FlowNodeState;
}

/**
 * One frame of the call trace. The active frame glows and lifts; frames the
 * request has already passed through stay lit; frames ahead of it recede.
 */
function FlowNodeComponent({ data }: NodeProps) {
  const { index, name, file, state } = data as FlowNodeData;
  const active = state === "active";

  return (
    <motion.div
      animate={{ scale: active ? 1.04 : 1, opacity: state === "future" ? 0.35 : 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
    >
      <div
        className={cn(
          "rounded-card relative flex h-full w-full items-center gap-3 border px-4 py-3",
          "bg-card/90 shadow-card backdrop-blur-sm transition-colors duration-250",
          active && "border-accent shadow-glow",
          state === "visited" && "border-accent/40",
          state === "future" && "border-border/60 border-dashed",
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!size-0 !border-0 !bg-transparent"
        />

        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
            active
              ? "bg-accent text-accent-foreground"
              : state === "visited"
                ? "bg-accent/15 text-accent"
                : "bg-muted text-muted-foreground",
          )}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium">
            <FunctionSquare className="size-3.5 shrink-0 text-amber-400" />
            {name}
          </p>
          <p className="text-muted-foreground truncate font-mono text-[10px]">{file}</p>
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

export const FlowNode = memo(FlowNodeComponent);
