"use client";

import { useState } from "react";
import { Code2, Loader2, X } from "lucide-react";

import { type GraphNode } from "@/lib/api";
import { useFile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { CodeViewer } from "@/components/explorer/code-viewer";

interface DetailsPanelProps {
  repositoryId: number;
  node: GraphNode;
  onClose: () => void;
}

export function DetailsPanel({ repositoryId, node, onClose }: DetailsPanelProps) {
  const [showSource, setShowSource] = useState(false);
  const fileId = node.meta.file_id ?? null;

  const { data: file, isLoading } = useFile(
    showSource ? repositoryId : null,
    showSource ? fileId : null,
  );

  return (
    <aside className="border-border bg-background/95 absolute top-4 right-4 z-10 flex max-h-[calc(100%-2rem)] w-80 flex-col rounded-xl border shadow-xl backdrop-blur">
      <div className="border-border flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{node.kind}</p>
          <h3 className="truncate text-sm font-semibold">{node.name}</h3>
          {node.path && (
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
              {node.path}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {node.meta.signature && (
          <pre className="border-border bg-muted/40 mb-3 overflow-x-auto rounded-md border p-2 font-mono text-[10px]">
            {node.meta.signature}
          </pre>
        )}

        {node.meta.start_line && (
          <p className="text-muted-foreground mb-3 text-xs">
            Lines {node.meta.start_line}–{node.meta.end_line}
          </p>
        )}

        {fileId ? (
          showSource ? (
            isLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> Loading source…
              </div>
            ) : file ? (
              <div className="border-border max-h-80 overflow-auto rounded-md border">
                <CodeViewer content={file.content} language={file.language} />
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Couldn&apos;t load source.</p>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowSource(true)}
            >
              <Code2 className="size-4" /> View source
            </Button>
          )
        ) : (
          <p className="text-muted-foreground text-xs">
            {node.kind === "external"
              ? "An external dependency — its source lives outside this repository."
              : "No source location for this node."}
          </p>
        )}
      </div>
    </aside>
  );
}
