"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

import { type GraphEdgeKind } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AtlasEdgeState = "active" | "normal" | "dim";

export interface AtlasEdgeData extends Record<string, unknown> {
  kind: GraphEdgeKind;
  weight: number;
  state: AtlasEdgeState;
}

/** Muted tone per relationship kind — color used sparingly. */
export const EDGE_TONE: Record<string, string> = {
  imports: "#3f3f46",
  calls: "#f59e0b",
  extends: "#a78bfa",
  implements: "#a78bfa",
};

const ACCENT = "#3b82f6";

/**
 * A thin curved connection between Software Cards. Active paths glow accent
 * blue, unrelated edges fade away, and "calls" edges carry a flowing dash —
 * animation only where it communicates movement.
 */
function AtlasEdgeComponent({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
}: EdgeProps) {
  const { kind, weight, state } = (data ?? {
    kind: "imports",
    weight: 1,
    state: "normal",
  }) as AtlasEdgeData;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const baseWidth = Math.min(1 + Math.log2(weight + 1), 2.5);
  const active = state === "active";

  return (
    <BaseEdge
      path={path}
      className={cn(kind === "calls" && state !== "dim" && "atlas-edge-animated")}
      style={{
        stroke: active ? ACCENT : (EDGE_TONE[kind] ?? "#3f3f46"),
        strokeWidth: active ? baseWidth + 0.5 : baseWidth,
        opacity: active ? 1 : state === "dim" ? 0.08 : 0.45,
        transition: "opacity 250ms ease, stroke 250ms ease",
      }}
      interactionWidth={12}
    />
  );
}

export const AtlasEdge = memo(AtlasEdgeComponent);
