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

/** How far each nesting level is indented. */
const INDENT = 12;

export function FileTree({ files, selectedId, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  // Everything starts open, so the tree shows as much as the old flat list did.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // A fresh repository resets nothing here on purpose — collapsing is cheap and
  // per-session; the initial "all open" comes from the empty set above.
  const toggle = (path: string) =>
    setCollapsed((prev) => {
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
          collapsed={collapsed}
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
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function TreeRow({ node, depth, collapsed, onToggle, selectedId, onSelect }: TreeRowProps) {
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
          <FileCode2 className="size-3.5 shrink-0 opacity-70" />
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

  const isOpen = !collapsed.has(node.path);
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
              collapsed={collapsed}
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
