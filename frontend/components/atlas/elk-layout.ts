import ELK from "elkjs/lib/elk.bundled.js";

import { type GraphEdge, type GraphNode, type GraphNodeKind } from "@/lib/api";

const elk = new ELK();

/** Node footprint per kind — bigger containers, smaller leaves. */
export const NODE_SIZE: Record<GraphNodeKind, { width: number; height: number }> = {
  repository: { width: 240, height: 76 },
  system: { width: 220, height: 72 },
  folder: { width: 190, height: 60 },
  file: { width: 190, height: 56 },
  class: { width: 180, height: 56 },
  function: { width: 170, height: 48 },
  external: { width: 160, height: 44 },
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
      "elk.spacing.nodeNode": "72",
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
