import { describe, expect, it } from "vitest";

import { type GraphNode } from "@/lib/api";
import { ancestorChain } from "@/lib/atlas-graph";

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
