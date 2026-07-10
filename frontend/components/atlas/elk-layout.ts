import ELK from "elkjs/lib/elk.bundled.js";

import { type Flow, type GraphEdge, type GraphNode, type GraphNodeKind } from "@/lib/api";

const elk = new ELK();

const FLOW_NODE = { width: 240, height: 64 };

export interface PositionedStep {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lay an execution path out left-to-right, so the request visibly travels
 * across the canvas rather than sprawling.
 */
export async function layoutFlow(flow: Flow): Promise<PositionedStep[]> {
  if (flow.steps.length === 0) return [];

  const graph = {
    id: "flow",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      // Keep the trace in the order the walker produced it.
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.edgeRouting": "SPLINES",
    },
    children: flow.steps.map((step) => ({ id: step.key, ...FLOW_NODE })),
    edges: flow.edges.map((edge, i) => ({
      id: `fe${i}`,
      sources: [edge.source_key],
      targets: [edge.target_key],
    })),
  };

  const laid = await elk.layout(graph);
  const byId = new Map((laid.children ?? []).map((child) => [child.id, child]));

  return flow.steps.map((step) => {
    const placed = byId.get(step.key);
    return {
      key: step.key,
      x: placed?.x ?? 0,
      y: placed?.y ?? 0,
      width: placed?.width ?? FLOW_NODE.width,
      height: placed?.height ?? FLOW_NODE.height,
    };
  });
}

/** Node footprint per kind — bigger containers, smaller leaves. */
export const NODE_SIZE: Record<GraphNodeKind, { width: number; height: number }> = {
  repository: { width: 260, height: 88 },
  system: { width: 240, height: 84 },
  folder: { width: 210, height: 72 },
  file: { width: 210, height: 72 },
  class: { width: 200, height: 72 },
  function: { width: 190, height: 64 },
  external: { width: 170, height: 52 },
};

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lay the current scope out with ELK's layered algorithm.
 *
 * We run this per scope (a handful of nodes at a time), never over the whole
 * graph — the Atlas only ever renders one level of one subtree.
 */
export async function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<PositionedNode[]> {
  if (nodes.length === 0) return [];

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "88",
      "elk.layered.spacing.nodeNodeBetweenLayers": "140",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.edgeRouting": "SPLINES",
    },
    children: nodes.map((node) => ({
      id: node.key,
      ...NODE_SIZE[node.kind],
    })),
    // Only keep edges whose endpoints are both on screen.
    edges: edges
      .filter((e) => nodes.some((n) => n.key === e.source_key))
      .filter((e) => nodes.some((n) => n.key === e.target_key))
      .map((e, i) => ({
        id: `e${i}`,
        sources: [e.source_key],
        targets: [e.target_key],
      })),
  };

  const laid = await elk.layout(graph);
  const byId = new Map((laid.children ?? []).map((child) => [child.id, child]));

  return nodes.map((node) => {
    const placed = byId.get(node.key);
    const size = NODE_SIZE[node.kind];
    return {
      ...node,
      x: placed?.x ?? 0,
      y: placed?.y ?? 0,
      width: placed?.width ?? size.width,
      height: placed?.height ?? size.height,
    };
  });
}
