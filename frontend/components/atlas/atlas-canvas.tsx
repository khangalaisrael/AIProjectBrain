"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  useOnViewportChange,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";

import "@xyflow/react/dist/base.css";

import { type Graph, type GraphEdge, type GraphEdgeKind, type GraphNode } from "@/lib/api";
import { ancestorChain, callChain, nodesTouchedBy, nodesWithMetaFlag } from "@/lib/atlas-graph";
import { useGraphChildren } from "@/lib/hooks";
import { AtlasNode, ICONS, type AtlasNodeData } from "@/components/atlas/atlas-node";
import { AtlasEdge, type AtlasEdgeData, type AtlasEdgeState } from "@/components/atlas/atlas-edge";
import { DetailsPanel } from "@/components/atlas/details-panel";
import { layoutGraph, type PositionedNode } from "@/components/atlas/elk-layout";
import { cn } from "@/lib/utils";

// Zoom past this and the camera dives into whatever is under the crosshair;
// zoom below the lower bound and it surfaces back out. Between them, free pan.
const ZOOM_ENTER = 1.9;
const ZOOM_EXIT = 0.55;
const BASE_ZOOM = 1;

const nodeTypes = { atlas: AtlasNode };
const edgeTypes = { atlas: AtlasEdge };

/** Muted per-kind fills for the minimap. */
const MINIMAP_TONE: Record<string, string> = {
  repository: "#1d4ed8",
  system: "#1d4ed8",
  folder: "#0369a1",
  file: "#047857",
  class: "#6d28d9",
  function: "#b45309",
  external: "#3f3f46",
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
  /**
   * Edge kinds this mode is about. When set, everything else on the map fades:
   * Dependency mode passes `["imports"]`. Omit for the unfiltered Architecture
   * view. A selection still wins — focus mode takes over the dimming.
   */
  emphasisKinds?: readonly GraphEdgeKind[];
  /**
   * A `meta` flag this mode is about, for modes that care what a node *is*
   * rather than how it connects. Database mode passes `"has_models"`.
   */
  emphasisMeta?: keyof GraphNode["meta"];
}

export function AtlasCanvas({
  repositoryId,
  fullGraph,
  rootKey,
  focusKey,
  onFocusHandled,
  emphasisKinds,
  emphasisMeta,
}: AtlasCanvasProps) {
  const { setCenter, fitView, getViewport, screenToFlowPosition } = useReactFlow();

  const byKey = useMemo(() => new Map(fullGraph.nodes.map((n) => [n.key, n])), [fullGraph.nodes]);

  // How many children each node has, for the card's count badge.
  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of fullGraph.nodes) {
      if (!node.parent_key) continue;
      counts.set(node.parent_key, (counts.get(node.parent_key) ?? 0) + 1);
    }
    return counts;
  }, [fullGraph.nodes]);

  const [stack, setStack] = useState<string[]>([rootKey]);
  const scope = stack[stack.length - 1];
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
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
    if (!byKey.has(focusKey)) return;
    pendingFocus.current = focusKey;
    setStack(ancestorChain(byKey, focusKey, rootKey));
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

  /** Select a node in the current scope and glide the camera onto it. */
  const navigateTo = useCallback(
    (key: string) => {
      const target = positioned.find((n) => n.key === key);
      const graphNode = byKey.get(key);
      if (!target || !graphNode) return;
      setSelected(graphNode);
      setCenter(target.x + target.width / 2, target.y + target.height / 2, {
        zoom: getViewport().zoom,
        duration: 300,
      });
    },
    [positioned, byKey, setCenter, getViewport],
  );

  /** The enterable node nearest the middle of the screen. */
  const nodeAtCrosshair = useCallback(
    (enterableOnly = true): GraphNode | null => {
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
        if (enterableOnly && !hasChildren(node)) continue;
        const dx = node.x + node.width / 2 - center.x;
        const dy = node.y + node.height / 2 - center.y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }
      return best;
    },
    [positioned, screenToFlowPosition],
  );

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

  // Keyboard navigation: arrows hop between cards, Enter dives in, Esc backs out.
  useEffect(() => {
    const container = document.getElementById("atlas-canvas");
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (selected) {
          event.preventDefault();
          enter(selected);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (selected) {
          setSelected(null);
        } else if (stack.length > 1) {
          goTo(stack.length - 2);
        }
        return;
      }

      const directions: Record<string, [number, number]> = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowDown: [0, 1],
        ArrowUp: [0, -1],
      };
      const dir = directions[event.key];
      if (!dir) return;
      event.preventDefault();

      const current = selected ? positioned.find((n) => n.key === selected.key) : null;
      if (!current) {
        const nearest = nodeAtCrosshair(false);
        if (nearest) navigateTo(nearest.key);
        return;
      }

      const cx = current.x + current.width / 2;
      const cy = current.y + current.height / 2;
      let best: PositionedNode | null = null;
      let bestDistance = Infinity;
      for (const node of positioned) {
        if (node.key === current.key) continue;
        const dx = node.x + node.width / 2 - cx;
        const dy = node.y + node.height / 2 - cy;
        // Must lie in the pressed direction, dominant-axis check.
        const along = dx * dir[0] + dy * dir[1];
        const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        if (along <= 0 || across > along * 2) continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }
      if (best) navigateTo(best.key);
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [selected, positioned, stack, enter, goTo, navigateTo, nodeAtCrosshair]);

  /**
   * Focus mode lights the whole chain through the selection, however long —
   * not just its immediate neighbours. Tier 1 is a direct caller or callee,
   * tier 2 is the rest of the chain, tier 3 is everything off it.
   */
  const tiers = useMemo(() => {
    if (!selected) return null;
    const visible = new Set(positioned.map((n) => n.key));
    return callChain(children?.edges ?? [], selected.key, visible);
  }, [selected, children?.edges, positioned]);

  const tierOf = useCallback(
    (key: string): 0 | 1 | 2 | 3 => {
      if (!tiers) return 0;
      const d = tiers.get(key);
      if (d === undefined) return 3;
      return d === 0 ? 0 : d === 1 ? 1 : 2;
    },
    [tiers],
  );

  /** True while `key` sits somewhere on the selected node's chain. */
  const onPath = useCallback((key: string) => tierOf(key) < 3, [tierOf]);

  const emphasis = useMemo(
    () => (emphasisKinds?.length ? new Set(emphasisKinds) : null),
    [emphasisKinds],
  );

  /** The only nodes this mode leaves lit: on an emphasised edge, or flagged. */
  const emphasised = useMemo(() => {
    if (emphasisMeta) return nodesWithMetaFlag(positioned, emphasisMeta);
    if (!emphasis) return null;
    const visible = new Set(positioned.map((n) => n.key));
    return nodesTouchedBy(children?.edges ?? [], emphasis, visible);
  }, [emphasis, emphasisMeta, children?.edges, positioned]);

  /**
   * A scope can hold nothing the mode cares about: the repository root has no
   * edges at all (backend and frontend talk over HTTP, not imports), and most
   * folders contain no ORM models. Dimming everything there would just grey out
   * the map, so the mode stands down and says so instead.
   */
  const emphasisEmpty = emphasised !== null && emphasised.size === 0;
  const emphasisActive = emphasised !== null && !emphasisEmpty;

  /** A selection means focus mode, which owns the dimming. Otherwise the mode does. */
  const nodeTier = useCallback(
    (key: string): 0 | 1 | 2 | 3 => {
      if (selected) return tierOf(key);
      if (emphasisActive) return emphasised!.has(key) ? 0 : 3;
      return 0;
    },
    [selected, tierOf, emphasisActive, emphasised],
  );

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
          description:
            node.meta.signature ??
            (node.kind === "function" ? undefined : (node.path ?? undefined)),
          hasChildren: hasChildren(node),
          childCount: childCounts.get(node.key),
          lineCount:
            node.meta.start_line && node.meta.end_line
              ? node.meta.end_line - node.meta.start_line + 1
              : undefined,
          tier: nodeTier(node.key),
        } satisfies AtlasNodeData,
      })),
    [positioned, selected, childCounts, nodeTier],
  );

  const flowEdges: Edge[] = useMemo(() => {
    const visible = new Set(positioned.map((n) => n.key));
    return (children?.edges ?? [])
      .filter((e: GraphEdge) => visible.has(e.source_key) && visible.has(e.target_key))
      .map((e, i) => {
        const id = `${e.kind}-${i}`;
        let state: AtlasEdgeState = "normal";
        if (id === hoveredEdgeId) {
          state = "active";
        } else if (
          emphasisActive &&
          // Edge-kind modes dim the wrong kind; meta modes dim anything that
          // doesn't run between two lit nodes.
          (emphasis
            ? !emphasis.has(e.kind)
            : !emphasised!.has(e.source_key) || !emphasised!.has(e.target_key))
        ) {
          state = "dim";
        } else if (selected) {
          if (e.source_key === selected.key || e.target_key === selected.key) {
            state = "active";
          } else if (onPath(e.source_key) && onPath(e.target_key)) {
            // A link further along the same chain, not just a direct neighbour.
            state = "normal";
          } else {
            state = "dim";
          }
        }
        return {
          id,
          source: e.source_key,
          target: e.target_key,
          type: "atlas",
          data: { kind: e.kind, weight: e.weight, state } satisfies AtlasEdgeData,
        };
      });
  }, [
    children?.edges,
    positioned,
    selected,
    hoveredEdgeId,
    onPath,
    emphasis,
    emphasised,
    emphasisActive,
  ]);

  const breadcrumb = stack.map((key) => byKey.get(key)).filter(Boolean) as GraphNode[];
  const settling = isLoading || laidOutFor !== scope;

  return (
    <div
      id="atlas-canvas"
      tabIndex={0}
      className="border-border rounded-card relative h-full w-full overflow-hidden border outline-none"
    >
      {/* Breadcrumb — the way back out of the map. */}
      <nav className="border-border/70 bg-card/80 shadow-card absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full border px-4 py-2 text-xs backdrop-blur">
        {breadcrumb.map((node, i) => {
          const isCurrent = i === breadcrumb.length - 1;
          const Icon = ICONS[node.kind];
          return (
            <span key={node.key} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="text-muted-foreground/50 size-3" />}
              <button
                onClick={() => goTo(i)}
                className={cn(
                  "flex max-w-[10rem] items-center gap-1.5 truncate transition-colors",
                  isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isCurrent && <Icon className="size-3 shrink-0" />}
                <span className="truncate">{node.name}</span>
              </button>
            </span>
          );
        })}
        {settling && <Loader2 className="text-muted-foreground ml-1 size-3 animate-spin" />}
      </nav>

      {positioned.length === 0 && !settling && (
        <p className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center text-sm">
          Nothing inside this node.
        </p>
      )}

      {emphasisEmpty && !settling && positioned.length > 0 && (
        <p className="border-border/70 bg-card/80 text-muted-foreground absolute top-4 right-4 z-10 max-w-xs rounded-full border px-3 py-1.5 text-[11px] backdrop-blur">
          {emphasisMeta === "has_models"
            ? "No database models live here. Dive in to find them."
            : "Nothing here imports anything else. Dive in to see dependencies."}
        </p>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => {
          const graphNode = byKey.get(node.id);
          if (graphNode) setSelected(graphNode);
        }}
        onNodeDoubleClick={(_, node) => {
          const graphNode = byKey.get(node.id);
          if (graphNode) enter(graphNode);
        }}
        onPaneClick={() => setSelected(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        // Strip every trace of the node-editor: nothing is draggable or connectable.
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        minZoom={0.2}
        maxZoom={3}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--atlas-dot)" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => MINIMAP_TONE[(node.data as AtlasNodeData).kind] ?? "#3f3f46"}
          nodeBorderRadius={8}
          maskColor="rgb(9 9 11 / 0.75)"
          bgColor="var(--card)"
          className="!border-border !h-28 !w-44 overflow-hidden !rounded-xl !border"
        />
      </ReactFlow>

      <AnimatePresence>
        {selected && (
          <DetailsPanel
            key={selected.key}
            repositoryId={repositoryId}
            node={selected}
            edges={children?.edges ?? []}
            byKey={byKey}
            onNavigate={navigateTo}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
