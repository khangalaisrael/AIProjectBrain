import { type GraphEdge, type GraphEdgeKind, type GraphNode } from "@/lib/api";

/**
 * The ancestors of `focusKey`, root first, excluding the focus node itself.
 *
 * Used to rebuild the Atlas breadcrumb stack when a search jumps straight to a
 * deeply nested node. A node whose ancestors can't be resolved falls back to
 * `[rootKey]`, so the map always has somewhere to stand.
 *
 * Returns `[]` for a key that isn't in the graph — callers should treat that as
 * "leave the stack alone" rather than "reset to empty".
 */
export function ancestorChain(
  byKey: Map<string, GraphNode>,
  focusKey: string,
  rootKey: string,
): string[] {
  const target = byKey.get(focusKey);
  if (!target) return [];

  const chain: string[] = [];
  // A parent_key cycle would otherwise spin forever and hang the tab.
  const seen = new Set<string>([focusKey]);

  let cursor = target.parent_key ? byKey.get(target.parent_key) : undefined;
  while (cursor && !seen.has(cursor.key)) {
    seen.add(cursor.key);
    chain.unshift(cursor.key);
    cursor = cursor.parent_key ? byKey.get(cursor.parent_key) : undefined;
  }

  return chain.length ? chain : [rootKey];
}

/**
 * Hop distance from `selectedKey` along the directed chain running through it:
 * everything it reaches downstream, plus everything that reaches it upstream.
 *
 * Deliberately *not* an undirected walk. Two functions that merely share a
 * caller are not on each other's path, and lighting them up is what made the
 * old two-hop neighbourhood noisy. Following edge direction keeps the chain a
 * chain.
 *
 * Distances are the shortest hop count in whichever direction found the node.
 * Cycles terminate — a node is measured once.
 */
export function callChain(
  edges: readonly GraphEdge[],
  selectedKey: string,
  visible: ReadonlySet<string>,
): Map<string, number> {
  const downstream = new Map<string, Set<string>>();
  const upstream = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!visible.has(edge.source_key) || !visible.has(edge.target_key)) continue;
    if (!downstream.has(edge.source_key)) downstream.set(edge.source_key, new Set());
    if (!upstream.has(edge.target_key)) upstream.set(edge.target_key, new Set());
    downstream.get(edge.source_key)!.add(edge.target_key);
    upstream.get(edge.target_key)!.add(edge.source_key);
  }

  const distance = new Map<string, number>([[selectedKey, 0]]);

  for (const adjacency of [downstream, upstream]) {
    let frontier = [selectedKey];
    for (let depth = 1; frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const key of frontier) {
        for (const neighbor of adjacency.get(key) ?? []) {
          const known = distance.get(neighbor);
          if (known !== undefined && known <= depth) continue;
          distance.set(neighbor, depth);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
  }

  return distance;
}

/**
 * The nodes that at least one edge of an emphasised kind touches.
 *
 * A focused Atlas mode (Dependency emphasises `imports`) fades everything this
 * doesn't return, so a node only stays lit if it actually participates in the
 * relationship being shown. Edges pointing outside `visible` are ignored — they
 * belong to a scope that isn't on screen.
 */
export function nodesTouchedBy(
  edges: readonly GraphEdge[],
  kinds: ReadonlySet<GraphEdgeKind>,
  visible: ReadonlySet<string>,
): Set<string> {
  const touched = new Set<string>();
  for (const edge of edges) {
    if (!kinds.has(edge.kind)) continue;
    if (!visible.has(edge.source_key) || !visible.has(edge.target_key)) continue;
    touched.add(edge.source_key);
    touched.add(edge.target_key);
  }
  return touched;
}

/**
 * The nodes carrying a `meta` flag set by the graph builder.
 *
 * Some modes are about *what a node is* rather than how it connects. Database
 * mode lights `has_models`, which the builder propagates from each ORM model
 * class up to its file, folders and system — so the flag survives zooming out.
 */
export function nodesWithMetaFlag(
  nodes: readonly GraphNode[],
  flag: keyof GraphNode["meta"],
): Set<string> {
  const flagged = new Set<string>();
  for (const node of nodes) {
    if (node.meta[flag]) flagged.add(node.key);
  }
  return flagged;
}
