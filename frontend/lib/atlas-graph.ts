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
