import { type FileTreeItem } from "@/lib/api";

/**
 * Turns the backend's flat `FileTreeItem[]` (each a full path like
 * `backend/app/core/config.py`) into a nested folder tree the explorer can
 * render. Pure and separate from the component so the grouping, sorting and
 * folder-compaction can be tested on their own.
 */

export interface TreeFile {
  type: "file";
  name: string;
  path: string;
  item: FileTreeItem;
}

export interface TreeFolder {
  type: "folder";
  /** Display label — may be a compacted chain like `app/core`. */
  name: string;
  /** Full folder path, unique; used as the expand/collapse key. */
  path: string;
  children: TreeNode[];
}

export type TreeNode = TreeFolder | TreeFile;

function isFolder(node: TreeNode): node is TreeFolder {
  return node.type === "folder";
}

/** Folders before files, then alphabetical (case-insensitive), recursively. */
function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return isFolder(a) ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  for (const node of nodes) if (isFolder(node)) sortNodes(node.children);
}

/**
 * Collapse a run of single-subfolder folders into one node, so a deep monorepo
 * path like `backend` → `app` → `infrastructure` shows as `backend/app/…`
 * instead of three clicks deep. This is VS Code's "compact folders" behaviour.
 */
function compact(node: TreeNode): TreeNode {
  if (node.type === "file") return node;

  let folder = node;
  while (folder.children.length === 1 && isFolder(folder.children[0])) {
    const only = folder.children[0];
    folder = {
      type: "folder",
      name: `${folder.name}/${only.name}`,
      path: only.path,
      children: only.children,
    };
  }
  return { ...folder, children: folder.children.map(compact) };
}

/**
 * Build the tree. Set `compactFolders` false to keep every folder level as its
 * own node.
 */
export function buildFileTree(files: readonly FileTreeItem[], compactFolders = true): TreeNode[] {
  const root: TreeFolder = { type: "folder", name: "", path: "", children: [] };

  for (const item of files) {
    const parts = item.path.split("/");
    const fileName = parts.pop() ?? item.path;

    let cursor = root;
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      let next = cursor.children.find(
        (child): child is TreeFolder => isFolder(child) && child.path === accumulated,
      );
      if (!next) {
        next = { type: "folder", name: part, path: accumulated, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    }

    cursor.children.push({ type: "file", name: fileName, path: item.path, item });
  }

  sortNodes(root.children);
  return compactFolders ? root.children.map(compact) : root.children;
}

/** Every folder path in the tree — handy for "expand all" as an initial state. */
export function allFolderPaths(nodes: readonly TreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (isFolder(node)) {
      paths.push(node.path);
      paths.push(...allFolderPaths(node.children));
    }
  }
  return paths;
}
