import { describe, expect, it } from "vitest";

import { type GraphEdge, type GraphEdgeKind, type GraphNode } from "@/lib/api";
import { ancestorChain, nodesTouchedBy } from "@/lib/atlas-graph";

function node(key: string, parent_key: string | null): GraphNode {
  return { key, kind: "function", level: 4, name: key, path: null, parent_key, meta: {} };
}

/** Build a lookup from `key -> parent_key` pairs. */
function graph(...pairs: [string, string | null][]): Map<string, GraphNode> {
  return new Map(pairs.map(([key, parent]) => [key, node(key, parent)]));
}

const ROOT = "repo";

describe("ancestorChain", () => {
  it("returns an empty chain for a key that is not in the graph", () => {
    expect(ancestorChain(graph(["a", null]), "missing", ROOT)).toEqual([]);
  });

  it("falls back to the root when the focus node has no parent", () => {
    expect(ancestorChain(graph(["a", null]), "a", ROOT)).toEqual([ROOT]);
  });

  it("returns the single parent of a one-level-deep node", () => {
    expect(ancestorChain(graph(["parent", null], ["child", "parent"]), "child", ROOT)).toEqual([
      "parent",
    ]);
  });

  it("orders a deep chain root first, excluding the focus node", () => {
    const g = graph(["repo", null], ["folder", "repo"], ["file", "folder"], ["fn", "file"]);
    expect(ancestorChain(g, "fn", ROOT)).toEqual(["repo", "folder", "file"]);
  });

  it("stops walking at a parent_key that is not in the graph", () => {
    // "file" claims a parent that was never loaded into the map.
    const g = graph(["file", "unloaded-folder"], ["fn", "file"]);
    expect(ancestorChain(g, "fn", ROOT)).toEqual(["file"]);
  });

  it("falls back to the root when the only parent is dangling", () => {
    expect(ancestorChain(graph(["a", "ghost"]), "a", ROOT)).toEqual([ROOT]);
  });

  it("terminates on a parent_key cycle instead of looping forever", () => {
    // a -> b -> a. Without the visited guard this hangs.
    const g = graph(["a", "b"], ["b", "a"]);
    expect(ancestorChain(g, "a", ROOT)).toEqual(["b"]);
  });

  it("terminates when a node is its own parent", () => {
    expect(ancestorChain(graph(["a", "a"]), "a", ROOT)).toEqual([ROOT]);
  });
});

function edge(source_key: string, target_key: string, kind: GraphEdgeKind): GraphEdge {
  return { source_key, target_key, kind, weight: 1 };
}

const IMPORTS = new Set<GraphEdgeKind>(["imports"]);

describe("nodesTouchedBy", () => {
  it("returns both ends of a matching edge", () => {
    const touched = nodesTouchedBy([edge("a", "b", "imports")], IMPORTS, new Set(["a", "b"]));
    expect([...touched].sort()).toEqual(["a", "b"]);
  });

  it("ignores edges of other kinds", () => {
    const edges = [edge("a", "b", "calls"), edge("c", "d", "contains")];
    expect(nodesTouchedBy(edges, IMPORTS, new Set(["a", "b", "c", "d"])).size).toBe(0);
  });

  it("keeps only the nodes on matching edges when kinds are mixed", () => {
    const edges = [edge("a", "b", "imports"), edge("c", "d", "calls")];
    const touched = nodesTouchedBy(edges, IMPORTS, new Set(["a", "b", "c", "d"]));
    expect([...touched].sort()).toEqual(["a", "b"]);
    expect(touched.has("c")).toBe(false);
  });

  it("drops an edge whose source is outside the visible scope", () => {
    const touched = nodesTouchedBy([edge("offscreen", "b", "imports")], IMPORTS, new Set(["b"]));
    expect(touched.size).toBe(0);
  });

  it("drops an edge whose target is outside the visible scope", () => {
    const touched = nodesTouchedBy([edge("a", "offscreen", "imports")], IMPORTS, new Set(["a"]));
    expect(touched.size).toBe(0);
  });

  it("deduplicates a node reached by several edges", () => {
    const edges = [edge("a", "b", "imports"), edge("a", "c", "imports")];
    const touched = nodesTouchedBy(edges, IMPORTS, new Set(["a", "b", "c"]));
    expect(touched.size).toBe(3);
  });

  it("returns nothing for an empty edge list", () => {
    expect(nodesTouchedBy([], IMPORTS, new Set(["a"])).size).toBe(0);
  });

  it("supports emphasising several kinds at once", () => {
    const edges = [edge("a", "b", "extends"), edge("c", "d", "implements")];
    const kinds = new Set<GraphEdgeKind>(["extends", "implements"]);
    const touched = nodesTouchedBy(edges, kinds, new Set(["a", "b", "c", "d"]));
    expect([...touched].sort()).toEqual(["a", "b", "c", "d"]);
  });
});
