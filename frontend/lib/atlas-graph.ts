import { type GraphNode } from "@/lib/api";

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
