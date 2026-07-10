"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Code2, Loader2, Sparkles, X } from "lucide-react";

import { type GraphEdge, type GraphNode } from "@/lib/api";
import { useExplainFile, useFile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { CodeViewer } from "@/components/explorer/code-viewer";
import { Markdown } from "@/components/chat/markdown";
import { ICONS, TONES } from "@/components/atlas/atlas-node";
import { cn } from "@/lib/utils";

const MAX_DEPENDENCY_ROWS = 8;
const MAX_RELATED_ROWS = 5;

interface DetailsPanelProps {
  repositoryId: number;
  node: GraphNode;
  edges: GraphEdge[];
  byKey: Map<string, GraphNode>;
  onNavigate: (key: string) => void;
  onClose: () => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">
      {children}
    </p>
  );
}

function NodeRow({
  node,
  hint,
  onNavigate,
}: {
  node: GraphNode;
  hint?: string;
  onNavigate: (key: string) => void;
}) {
  const Icon = ICONS[node.kind];
  return (
    <button
      onClick={() => onNavigate(node.key)}
      className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
    >
      <Icon className={cn("size-3.5 shrink-0", TONES[node.kind])} />
      <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
      {hint && <span className="text-muted-foreground/70 shrink-0 text-[10px]">{hint}</span>}
    </button>
  );
}

export function DetailsPanel({
  repositoryId,
  node,
  edges,
  byKey,
  onNavigate,
  onClose,
}: DetailsPanelProps) {
  const [showSource, setShowSource] = useState(false);
  const fileId = node.meta.file_id ?? null;
  const Icon = ICONS[node.kind];

  const { data: file, isLoading } = useFile(
    showSource ? repositoryId : null,
    showSource ? fileId : null,
  );

  // The explain endpoint works on files, so for a class or function we explain
  // the file it lives in — labelled honestly below.
  const explain = useExplainFile();
  const explainedFileName = node.path?.split("/").pop() ?? "this file";

  // Relationships within the current scope, split by direction.
  const { outgoing, incoming } = useMemo(() => {
    const out: { node: GraphNode; kind: string }[] = [];
    const inc: { node: GraphNode; kind: string }[] = [];
    for (const e of edges) {
      if (e.source_key === node.key) {
        const target = byKey.get(e.target_key);
        if (target) out.push({ node: target, kind: e.kind });
      } else if (e.target_key === node.key) {
        const source = byKey.get(e.source_key);
        if (source) inc.push({ node: source, kind: e.kind });
      }
    }
    return { outgoing: out, incoming: inc };
  }, [edges, node.key, byKey]);

  // Siblings that live in the same parent — nearby places worth visiting.
  const related = useMemo(() => {
    if (!node.parent_key) return [];
    const siblings: GraphNode[] = [];
    for (const candidate of byKey.values()) {
      if (candidate.parent_key !== node.parent_key || candidate.key === node.key) continue;
      if (candidate.kind !== "file" && candidate.kind !== "class") continue;
      siblings.push(candidate);
      if (siblings.length >= MAX_RELATED_ROWS) break;
    }
    return siblings;
  }, [node, byKey]);

  const lineCount =
    node.meta.start_line && node.meta.end_line
      ? node.meta.end_line - node.meta.start_line + 1
      : null;

  const metrics: { label: string; value: string | number }[] = [
    ...(lineCount ? [{ label: "Lines", value: lineCount }] : []),
    { label: "Uses", value: outgoing.length },
    { label: "Used by", value: incoming.length },
  ];

  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="border-border/70 bg-background/95 rounded-card shadow-card-hover absolute top-4 right-4 z-10 flex max-h-[calc(100%-2rem)] w-96 flex-col border backdrop-blur"
    >
      <div className="border-border flex items-start justify-between gap-2 border-b p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className={cn("size-4", TONES[node.kind])} />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{node.kind}</p>
            <h3 className="truncate text-sm font-semibold">{node.name}</h3>
            {node.path && (
              <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                {node.path}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {node.meta.signature && (
          <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-2 font-mono text-[10px]">
            {node.meta.signature}
          </pre>
        )}

        {/* AI explanation */}
        {fileId && (
          <div>
            <SectionHeading>AI explanation</SectionHeading>
            {explain.data ? (
              <>
                {node.kind !== "file" && (
                  <p className="text-muted-foreground/70 mb-2 text-[10px]">
                    Explaining <span className="font-mono">{explainedFileName}</span>, the file this{" "}
                    {node.kind} lives in.
                  </p>
                )}
                <div className="border-border/70 bg-muted/20 max-h-64 overflow-y-auto rounded-lg border p-3">
                  <Markdown>{explain.data.explanation}</Markdown>
                </div>
              </>
            ) : explain.isError ? (
              <p className="text-muted-foreground text-xs">
                Couldn&apos;t generate an explanation. Try again.
              </p>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={explain.isPending}
                onClick={() => explain.mutate({ repositoryId, fileId })}
              >
                {explain.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Explain with AI
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Metrics */}
        <div>
          <SectionHeading>Metrics</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="border-border/70 bg-muted/30 rounded-lg border p-2">
                <p className="text-sm font-semibold tabular-nums">{m.value}</p>
                <p className="text-muted-foreground text-[10px]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dependencies */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div>
            <SectionHeading>Dependencies</SectionHeading>
            <div className="space-y-0.5">
              {outgoing.slice(0, MAX_DEPENDENCY_ROWS).map(({ node: dep, kind }, i) => (
                <div key={`out-${dep.key}-${i}`} className="flex items-center gap-1">
                  <ArrowUpRight className="text-muted-foreground/60 size-3 shrink-0" />
                  <NodeRow node={dep} hint={kind} onNavigate={onNavigate} />
                </div>
              ))}
              {outgoing.length > MAX_DEPENDENCY_ROWS && (
                <p className="text-muted-foreground/70 px-2 text-[10px]">
                  +{outgoing.length - MAX_DEPENDENCY_ROWS} more
                </p>
              )}
              {incoming.slice(0, MAX_DEPENDENCY_ROWS).map(({ node: dep, kind }, i) => (
                <div key={`in-${dep.key}-${i}`} className="flex items-center gap-1">
                  <ArrowDownLeft className="text-muted-foreground/60 size-3 shrink-0" />
                  <NodeRow node={dep} hint={`${kind} · used by`} onNavigate={onNavigate} />
                </div>
              ))}
              {incoming.length > MAX_DEPENDENCY_ROWS && (
                <p className="text-muted-foreground/70 px-2 text-[10px]">
                  +{incoming.length - MAX_DEPENDENCY_ROWS} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Related files */}
        {related.length > 0 && (
          <div>
            <SectionHeading>Related</SectionHeading>
            <div className="space-y-0.5">
              {related.map((sibling) => (
                <NodeRow key={sibling.key} node={sibling} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Source preview */}
        <div>
          <SectionHeading>Source</SectionHeading>
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
      </div>
    </motion.aside>
  );
}
