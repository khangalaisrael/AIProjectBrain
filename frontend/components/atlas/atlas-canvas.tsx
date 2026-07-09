"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, useOnViewportChange, useReactFlow, type Edge, type Node } from "@xyflow/react";
import { ChevronRight, Loader2 } from "lucide-react";

import "@xyflow/react/dist/base.css";

import { type Graph, type GraphEdge, type GraphNode } from "@/lib/api";
import { useGraphChildren } from "@/lib/hooks";
import { AtlasNode, type AtlasNodeData } from "@/components/atlas/atlas-node";
import { DetailsPanel } from "@/components/atlas/details-panel";
import { layoutGraph, type PositionedNode } from "@/components/atlas/elk-layout";
import { cn } from "@/lib/utils";

// Zoom past this and the camera dives into whatever is under the crosshair;
// zoom below the lower bound and it surfaces back out. Between them, free pan.
const ZOOM_ENTER = 1.9;
const ZOOM_EXIT = 0.55;
const BASE_ZOOM = 1;

const nodeTypes = { atlas: AtlasNode };

const EDGE_TONE: Record<string, string> = {
  imports: "#3f3f46",
  calls: "#f59e0b",
  extends: "#a78bfa",
  implements: "#a78bfa",
};

/** Leaves have nothing to dive into. */
function hasChildren(node: GraphNode): boolean {
  return node.kind !== "function" && node.kind !== "external";
}

interface AtlasCanvasProps {
  repositoryId: number;
  fullGraph: Graph;
  rootKey: string;
  focusKey: string | null;
  onFocusHandled: () => void;
}

export function AtlasCanvas({
  repositoryId,
  fullGraph,
  rootKey,
  focusKey,
  onFocusHandled,
}: AtlasCanvasProps) {
  const { setCenter, fitView, getViewport, screenToFlowPosition } = useReactFlow();

  const byKey = useMemo(() => new Map(fullGraph.nodes.map((n) => [n.key, n])), [fullGraph.nodes]);

  const [stack, setStack] = useState<string[]>([rootKey]);
  const scope = stack[stack.length - 1];
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [laidOutFor, setLaidOutFor] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const { data: children, isLoading } = useGraphChildren(repositoryId, scope);

  // Reset the stack when the repository changes underneath us.
  useEffect(() => {
    setStack([rootKey]);
    setSelected(null);
  }, [rootKey]);

  // Lay the current scope out whenever its contents change.
  useEffect(() => {
    let cancelled = false;
    if (!children) return;

    setLaidOutFor(null);
    layoutGraph(children.nodes, children.edges).then((laid) => {
      if (cancelled) return;
      setPositioned(laid);
      setLaidOutFor(scope);
    });
    return () => {
      cancelled = true;
    };
  }, [children, scope]);

  // Once laid out, frame the scope at a neutral zoom so we never sit on a
  // threshold and immediately re-trigger a level change.
  useEffect(() => {
    if (laidOutFor !== scope || positioned.length === 0) return;

    const focus = pendingFocus.current;
    if (focus) {
      const target = positioned.find((n) => n.key === focus);
      if (target) {
        setCenter(target.x + target.width / 2, target.y + target.height / 2, {
          zoom: 1.4,
          duration: 800,
        });
        setSelected(byKey.get(focus) ?? null);
        pendingFocus.current = null;
        onFocusHandled();
        return;
      }
    }
    fitView({ duration: 600, minZoom: BASE_ZOOM, maxZoom: BASE_ZOOM });
  }, [laidOutFor, scope, positioned, fitView, setCenter, byKey, onFocusHandled]);

  // A search hit: rebuild the stack down to the node's parent, then fly to it.
  useEffect(() => {
    if (!focusKey) return;
    const target = byKey.get(focusKey);
    if (!target) return;

    const chain: string[] = [];
    let cursor: GraphNode | undefined = target.parent_key
      ? byKey.get(target.parent_key)
      : undefined;
    while (cursor) {
      chain.unshift(cursor.key);
      cursor = cursor.parent_key ? byKey.get(cursor.parent_key) : undefined;
    }
    pendingFocus.current = focusKey;
    setStack(chain.length ? chain : [rootKey]);
  }, [focusKey, byKey, rootKey]);

  const enter = useCallback((node: GraphNode) => {
    if (!hasChildren(node)) return;
    setSelected(null);
    setStack((prev) => [...prev, node.key]);
  }, []);

  const goTo = useCallback((index: number) => {
    setSelected(null);
    setStack((prev) => prev.slice(0, index + 1));
  }, []);

  /** The enterable node nearest the middle of the screen. */
  const nodeAtCrosshair = useCallback((): GraphNode | null => {
    const container = document.getElementById("atlas-canvas");
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });

    let best: PositionedNode | null = null;
    let bestDistance = Infinity;
    for (const node of positioned) {
      if (!hasChildren(node)) continue;
      const dx = node.x + node.width / 2 - center.x;
      const dy = node.y + node.height / 2 - center.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }
    return best;
  }, [positioned, screenToFlowPosition]);

  useOnViewportChange({
    onEnd: () => {
      const { zoom } = getViewport();
      if (zoom >= ZOOM_ENTER) {
        const target = nodeAtCrosshair();
        if (target) enter(target);
        return;
      }
      if (zoom <= ZOOM_EXIT && stack.length > 1) {
        goTo(stack.length - 2);
      }
    },
  });

  const flowNodes: Node[] = useMemo(
    () =>
      positioned.map((node) => ({
        id: node.key,
        type: "atlas",
        position: { x: node.x, y: node.y },
        width: node.width,
        height: node.height,
        selected: selected?.key === node.key,
        data: {
          kind: node.kind,
          label: node.name,
          sublabel: node.kind === "function" ? undefined : (node.path ?? undefined),
          hasChildren: hasChildren(node),
        } satisfies AtlasNodeData,
      })),
    [positioned, selected],
  );

  const flowEdges: Edge[] = useMemo(() => {
    const visible = new Set(positioned.map((n) => n.key));
    return (children?.edges ?? [])
      .filter((e: GraphEdge) => visible.has(e.source_key) && visible.has(e.target_key))
      .map((e, i) => ({
        id: `${e.kind}-${i}`,
        source: e.source_key,
        target: e.target_key,
        animated: e.kind === "calls",
        style: {
          stroke: EDGE_TONE[e.kind] ?? "#3f3f46",
          strokeWidth: Math.min(1 + Math.log2(e.weight + 1), 3),
          opacity: 0.75,
        },
      }));
  }, [children?.edges, positioned]);

  const breadcrumb = stack.map((key) => byKey.get(key)).filter(Boolean) as GraphNode[];
  const settling = isLoading || laidOutFor !== scope;

  return (
    <div
      id="atlas-canvas"
      className="border-border relative h-full w-full overflow-hidden rounded-lg border"
    >
      {/* Breadcrumb — the way back out of the map. */}
      <nav className="border-border bg-background/80 absolute top-4 left-4 z-10 flex items-center gap-1 rounded-lg border px-3 py-2 text-xs backdrop-blur">
        {breadcrumb.map((node, i) => (
          <span key={node.key} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="text-muted-foreground/50 size-3" />}
            <button
              onClick={() => goTo(i)}
              className={cn(
                "max-w-[10rem] truncate transition-colors",
                i === breadcrumb.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {node.name}
            </button>
          </span>
        ))}
        {settling && <Loader2 className="text-muted-foreground ml-1 size-3 animate-spin" />}
      </nav>

      {positioned.length === 0 && !settling && (
        <p className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center text-sm">
          Nothing inside this node.
        </p>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          const graphNode = byKey.get(node.id);
          if (graphNode) setSelected(graphNode);
        }}
        onNodeDoubleClick={(_, node) => {
          const graphNode = byKey.get(node.id);
          if (graphNode) enter(graphNode);
        }}
        // Strip every trace of the node-editor: nothing is draggable or connectable.
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        minZoom={0.2}
        maxZoom={3}
        className="bg-background"
      />

      {selected && (
        <DetailsPanel
          repositoryId={repositoryId}
          node={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
