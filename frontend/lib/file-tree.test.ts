import { describe, expect, it } from "vitest";

import { type FileTreeItem } from "@/lib/api";
import { allFolderPaths, buildFileTree, type TreeFolder, type TreeNode } from "@/lib/file-tree";

let nextId = 1;
function file(path: string, function_count = 0): FileTreeItem {
  return { id: nextId++, path, language: null, function_count };
}

/** Compact shape for assertions: folders as `name/`, files as `name`. */
function shape(nodes: readonly TreeNode[]): unknown {
  return nodes.map((n) => (n.type === "folder" ? { [`${n.name}/`]: shape(n.children) } : n.name));
}

const folder = (nodes: readonly TreeNode[], name: string): TreeFolder => {
  const found = nodes.find((n): n is TreeFolder => n.type === "folder" && n.name === name);
  if (!found) throw new Error(`no folder ${name}`);
  return found;
};

describe("buildFileTree", () => {
  it("returns an empty tree for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("keeps a root-level file at the top level", () => {
    expect(shape(buildFileTree([file("README.md")]))).toEqual(["README.md"]);
  });

  it("nests a file under its folders", () => {
    const tree = buildFileTree([file("src/lib/util.ts")], false);
    expect(shape(tree)).toEqual([{ "src/": [{ "lib/": ["util.ts"] }] }]);
  });

  it("groups sibling files under one folder node", () => {
    const tree = buildFileTree([file("src/a.ts"), file("src/b.ts")], false);
    expect(shape(tree)).toEqual([{ "src/": ["a.ts", "b.ts"] }]);
  });

  it("orders folders before files, each alphabetically", () => {
    const tree = buildFileTree(
      [file("zebra.ts"), file("src/one.ts"), file("apple.ts"), file("docs/x.md")],
      false,
    );
    // folders (docs, src) first and sorted, then files (apple, zebra) sorted.
    expect(shape(tree)).toEqual([
      { "docs/": ["x.md"] },
      { "src/": ["one.ts"] },
      "apple.ts",
      "zebra.ts",
    ]);
  });

  it("sorts case-insensitively", () => {
    const tree = buildFileTree([file("Zoo.ts"), file("apple.ts")], false);
    expect(shape(tree)).toEqual(["apple.ts", "Zoo.ts"]);
  });

  it("compacts a single-subfolder chain into one node", () => {
    // backend → app → core, each with one child, collapses to "backend/app/core".
    const tree = buildFileTree([file("backend/app/core/config.py")]);
    expect(shape(tree)).toEqual([{ "backend/app/core/": ["config.py"] }]);
  });

  it("stops compacting where a folder branches", () => {
    const tree = buildFileTree([file("backend/app/main.py"), file("backend/app/core/config.py")]);
    // backend → app compacts (single child chain), then app branches into
    // {core/, main.py} so it stops.
    expect(shape(tree)).toEqual([{ "backend/app/": [{ "core/": ["config.py"] }, "main.py"] }]);
  });

  it("does not compact a folder whose only child is a file", () => {
    const tree = buildFileTree([file("src/only.ts")]);
    expect(shape(tree)).toEqual([{ "src/": ["only.ts"] }]);
  });

  it("carries the FileTreeItem through onto the leaf", () => {
    const item = file("a/b.ts", 3);
    const tree = buildFileTree([item]);
    const leaf = folder(tree, "a").children[0];
    expect(leaf.type === "file" && leaf.item).toEqual(item);
    expect(leaf.type === "file" && leaf.item.function_count).toBe(3);
  });

  it("gives folders their full path even after compaction", () => {
    const tree = buildFileTree([file("a/b/c.ts")]);
    expect((tree[0] as TreeFolder).path).toBe("a/b");
    expect((tree[0] as TreeFolder).name).toBe("a/b");
  });
});

describe("allFolderPaths", () => {
  it("lists every folder path, nested included", () => {
    const tree = buildFileTree(
      [file("backend/app/main.py"), file("backend/app/core/config.py")],
      false,
    );
    expect(allFolderPaths(tree).sort()).toEqual(["backend", "backend/app", "backend/app/core"]);
  });

  it("returns nothing for a flat list of root files", () => {
    expect(allFolderPaths(buildFileTree([file("a.ts"), file("b.ts")]))).toEqual([]);
  });
});
