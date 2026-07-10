import { describe, expect, it } from "vitest";

import { type Flow, type GraphEdge, type GraphNode } from "@/lib/api";
import { NODE_SIZE, layoutFlow, layoutGraph } from "@/components/atlas/elk-layout";

/**
 * ELK is loaded through a dynamic import so it stays out of the /atlas bundle.
 * These tests exist mainly to prove that lazy path actually constructs and runs
 * -- `mod.default()` is the kind of interop that type-checks and then throws.
 */

function node(key: string, kind: GraphNode["kind"] = "file"): GraphNode {
  return { key, kind, level: 3, name: key, path: null, parent_key: null, meta: {} };
}

function edge(source_key: string, target_key: string): GraphEdge {
  return { source_key, target_key, kind: "imports", weight: 1 };
}

describe("layoutGraph", () => {
  it("returns an empty layout for no nodes without loading ELK", async () => {
    await expect(layoutGraph([], [])).resolves.toEqual([]);
  });

  it("assigns a position and a per-kind size to every node", async () => {
    const nodes = [node("a"), node("b")];
    const laid = await layoutGraph(nodes, [edge("a", "b")]);

    expect(laid).toHaveLength(2);
    for (const n of laid) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.width).toBe(NODE_SIZE.file.width);
      expect(n.height).toBe(NODE_SIZE.file.height);
    }
  });

  it("lays an import out left-to-right, so the dependency reads as a flow", async () => {
    const [a, b] = await layoutGraph([node("a"), node("b")], [edge("a", "b")]);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("preserves the original node fields", async () => {
    const [laid] = await layoutGraph([node("pkg/mod.ts", "class")], []);
    expect(laid.key).toBe("pkg/mod.ts");
    expect(laid.kind).toBe("class");
    expect(laid.width).toBe(NODE_SIZE.class.width);
  });

  it("ignores an edge pointing outside the laid-out nodes", async () => {
    const laid = await layoutGraph([node("a")], [edge("a", "offscreen")]);
    expect(laid).toHaveLength(1);
  });

  it("reuses the same ELK instance across calls", async () => {
    // A second layout must not re-import or fail on a cached promise.
    await layoutGraph([node("a")], []);
    await expect(layoutGraph([node("b")], [])).resolves.toHaveLength(1);
  });
});

describe("layoutFlow", () => {
  it("returns an empty layout for a flow with no steps", async () => {
    const flow = { steps: [], edges: [] } as unknown as Flow;
    await expect(layoutFlow(flow)).resolves.toEqual([]);
  });

  it("places each step of a request path", async () => {
    const flow = {
      steps: [{ key: "handler" }, { key: "service" }],
      edges: [{ source_key: "handler", target_key: "service" }],
    } as unknown as Flow;

    const laid = await layoutFlow(flow);
    expect(laid.map((s) => s.key)).toEqual(["handler", "service"]);
    expect(laid[1].x).toBeGreaterThan(laid[0].x);
  });
});
