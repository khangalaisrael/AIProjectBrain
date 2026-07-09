"use client";

import { useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Map as MapIcon, Search, Sparkles } from "lucide-react";

import { type GraphNode } from "@/lib/api";
import { useAuth, useGraph, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SignInButton } from "@/components/auth/auth-controls";
import { AtlasCanvas } from "@/components/atlas/atlas-canvas";
import { cn } from "@/lib/utils";

// Phase A ships Architecture. The rest of the spec's modes reuse this same
// graph with different highlighting and land next.
const MODES = [
  { id: "architecture", label: "Architecture", ready: true },
  { id: "request", label: "Request Flow", ready: false },
  { id: "auth", label: "Authentication", ready: false },
  { id: "dependency", label: "Dependency", ready: false },
  { id: "database", label: "Database", ready: false },
  { id: "deployment", label: "Deployment", ready: false },
  { id: "event", label: "Event Flow", ready: false },
];

const DEEPEST_LEVEL = 4;

export default function AtlasPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  // The whole graph, used for search and for walking a node's ancestor chain.
  const graph = useGraph(repositoryId, DEEPEST_LEVEL);

  const rootKey = useMemo(
    () => graph.data?.nodes.find((n) => n.kind === "repository")?.key ?? null,
    [graph.data],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !graph.data) return [];
    return graph.data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, graph.data]);

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader title="Atlas" description="An explorable map of the software." />
        <EmptyState
          icon={MapIcon}
          title="Sign in to open the Atlas"
          description="Connect GitHub and import a repository to map it."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader title="Atlas" description="An explorable map of the software." />
        <EmptyState
          icon={MapIcon}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish to explore its Atlas."
        />
      </>
    );
  }

  const hasGraph = (graph.data?.nodes.length ?? 0) > 0 && rootKey;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Atlas" description="An explorable map of the software." />
        <select
          value={repositoryId ?? ""}
          onChange={(e) => setRepositoryId(Number(e.target.value))}
          className="border-border bg-background text-foreground h-9 rounded-md border px-2 text-sm"
        >
          {readyRepos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Modes + search */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="border-border inline-flex flex-wrap rounded-md border p-0.5">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              disabled={!mode.ready}
              title={mode.ready ? undefined : "Coming next"}
              className={cn(
                "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode.ready
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/40 cursor-not-allowed",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="border-border bg-muted/40 flex h-9 w-72 items-center gap-2 rounded-md border px-3">
            <Search className="text-muted-foreground size-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the map…"
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
          </div>
          {matches.length > 0 && (
            <ul className="border-border bg-background absolute z-20 mt-1 w-72 overflow-hidden rounded-md border shadow-xl">
              {matches.map((node: GraphNode) => (
                <li key={node.key}>
                  <button
                    onClick={() => {
                      setFocusKey(node.key);
                      setQuery("");
                    }}
                    className="hover:bg-muted flex w-full flex-col items-start px-3 py-2 text-left"
                  >
                    <span className="text-xs font-medium">{node.name}</span>
                    <span className="text-muted-foreground truncate text-[10px]">
                      {node.kind}
                      {node.path ? ` · ${node.path}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {graph.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading the map…</p>
        ) : hasGraph ? (
          <ReactFlowProvider>
            <AtlasCanvas
              repositoryId={repositoryId as number}
              fullGraph={graph.data!}
              rootKey={rootKey as string}
              focusKey={focusKey}
              onFocusHandled={() => setFocusKey(null)}
            />
          </ReactFlowProvider>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No map for this repository yet"
            description="The Atlas is built during indexing. Re-import or re-index this repository to generate its knowledge graph."
          />
        )}
      </div>

      <p className="text-muted-foreground mt-2 text-[10px]">
        Zoom in to dive into a node, zoom out to surface. Call and import edges are resolved by name
        and are approximate.
      </p>
    </div>
  );
}
