"use client";

import { useMemo, useState } from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";

import { type FileTreeItem } from "@/lib/api";
import { buildFileTree, type TreeNode } from "@/lib/file-tree";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  files: FileTreeItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Icon tint by file extension, so the tree is scannable at a glance. */
function fileTint(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (["ts", "tsx"].includes(ext)) return "text-blue-400";
  if (["js", "jsx", "mjs", "cjs"].includes(ext)) return "text-amber-400";
  if (ext === "py") return "text-yellow-400";
  if (["json", "yml", "yaml", "toml", "ini", "env"].includes(ext)) return "text-emerald-400";
  if (["md", "mdx", "txt", "rst"].includes(ext)) return "text-sky-300";
  if (["css", "scss", "html"].includes(ext)) return "text-pink-400";
  if (["go", "rs", "java", "rb", "cs", "cpp", "c", "h"].includes(ext)) return "text-orange-400";
  return "opacity-70";
}

/** How far each nesting level is indented. */
const INDENT = 12;

export function FileTree({ files, selectedId, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  // Every folder starts closed; the user opens the ones they want.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  return (
    <ul className="p-1">
      {tree.map((node) => (
        <TreeRow
          key={nodeKey(node)}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function nodeKey(node: TreeNode): string {
  return node.type === "folder" ? `d:${node.path}` : `f:${node.item.id}`;
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function TreeRow({ node, depth, expanded, onToggle, selectedId, onSelect }: TreeRowProps) {
  const pad = { paddingLeft: 8 + depth * INDENT };

  if (node.type === "file") {
    const selected = node.item.id === selectedId;
    return (
      <li>
        <button
          onClick={() => onSelect(node.item.id)}
          title={node.path}
          style={pad}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
            selected
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <FileCode2 className={cn("size-3.5 shrink-0", fileTint(node.name))} />
          <span className="truncate">{node.name}</span>
          {node.item.function_count > 0 && (
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {node.item.function_count}
            </span>
          )}
        </button>
      </li>
    );
  }

  const isOpen = expanded.has(node.path);
  return (
    <li>
      <button
        onClick={() => onToggle(node.path)}
        title={node.path}
        style={pad}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm font-medium transition-colors"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
        />
        {isOpen ? (
          <FolderOpen className="size-3.5 shrink-0 opacity-70" />
        ) : (
          <Folder className="size-3.5 shrink-0 opacity-70" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={nodeKey(child)}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
