"use client";

import { useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Map as MapIcon, Search, Sparkles } from "lucide-react";

import { useAuth, useGraph, useRepositories } from "@/lib/hooks";
import { useCommandPaletteStore } from "@/lib/command-palette-store";
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
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const { setOpen: setPaletteOpen, setAtlasActions } = useCommandPaletteStore();

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  // The whole graph, used for palette search and for walking ancestor chains.
  const graph = useGraph(repositoryId, DEEPEST_LEVEL);

  const rootKey = useMemo(
    () => graph.data?.nodes.find((n) => n.kind === "repository")?.key ?? null,
    [graph.data],
  );

  // Contribute this map's nodes to the global Ctrl+K palette while mounted.
  useEffect(() => {
    if (!graph.data) return;
    setAtlasActions({
      nodes: graph.data.nodes,
      onSelect: (key) => setFocusKey(key),
    });
    return () => setAtlasActions(null);
  }, [graph.data, setAtlasActions]);

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
        <div className="border-border/70 bg-muted/30 inline-flex flex-wrap gap-0.5 rounded-full border p-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              disabled={!mode.ready}
              title={mode.ready ? undefined : "Coming next"}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                mode.ready
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground/40 cursor-not-allowed",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="border-border bg-muted/40 text-muted-foreground hover:bg-muted flex h-9 w-64 items-center gap-2 rounded-full border px-4 text-sm transition-colors"
        >
          <Search className="size-4" />
          <span>Search the map…</span>
          <kbd className="border-border ml-auto rounded border px-1.5 text-xs">Ctrl K</kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {graph.isLoading ? (
          <div className="border-border/70 bg-card/60 text-muted-foreground mx-auto mt-16 flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm backdrop-blur">
            <MapIcon className="size-4 animate-pulse" /> Mapping the repository…
          </div>
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
        Zoom or press Enter to dive into a node, Esc to surface. Arrow keys hop between cards. Call
        and import edges are resolved by name and are approximate.
      </p>
    </div>
  );
}
