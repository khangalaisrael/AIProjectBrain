"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Globe, Loader2, Lock, Plus, Search, Star, User } from "lucide-react";

import { type GitHubRepo, type Repository } from "@/lib/api";
import {
  useGitHubRepositories,
  useImportRepository,
  useSearchGitHubRepositories,
} from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "mine" | "public";

interface ImportPanelProps {
  imported: Repository[];
}

/** Debounce a value so we don't hit GitHub search on every keystroke. */
function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function ImportPanel({ imported }: ImportPanelProps) {
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);

  const mine = useGitHubRepositories(tab === "mine");
  const search = useSearchGitHubRepositories(tab === "public" ? debouncedQuery : "");
  const importMutation = useImportRepository();

  const importedNames = useMemo(() => new Set(imported.map((r) => r.full_name)), [imported]);

  // In "mine" the query filters locally; in "public" it queries GitHub.
  const results = useMemo(() => {
    if (tab === "public") return search.data ?? [];
    const repos = mine.data ?? [];
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.full_name.toLowerCase().includes(q)) : repos;
  }, [tab, search.data, mine.data, query]);

  const isLoading = tab === "mine" ? mine.isLoading : search.isLoading;
  const isError = tab === "mine" ? mine.isError : search.isError;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="border-border inline-flex rounded-md border p-0.5">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")} icon={User}>
          My repos
        </TabButton>
        <TabButton active={tab === "public"} onClick={() => setTab("public")} icon={Globe}>
          Search public
        </TabButton>
      </div>

      {/* Search / filter box */}
      <div className="border-border bg-muted/40 flex h-9 items-center gap-2 rounded-md border px-3">
        <Search className="text-muted-foreground size-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "mine"
              ? "Filter your repositories…"
              : "Search any public repo (e.g. psf/requests, fastapi)…"
          }
          className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
        />
        {tab === "public" && search.isFetching && (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        )}
      </div>

      {/* Results */}
      {tab === "public" && !debouncedQuery.trim() ? (
        <Card className="text-muted-foreground p-6 text-center text-sm">
          Search GitHub for any public repository, then import it to analyze.
        </Card>
      ) : isLoading ? (
        <Card className="flex items-center justify-center gap-2 p-8 text-sm">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
          <span className="text-muted-foreground">Loading…</span>
        </Card>
      ) : isError ? (
        <Card className="text-muted-foreground p-6 text-sm">
          Couldn&apos;t load repositories. Try again.
        </Card>
      ) : results.length === 0 ? (
        <Card className="text-muted-foreground p-6 text-center text-sm">
          No repositories found.
        </Card>
      ) : (
        <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
          {results.map((repo) => (
            <ImportRow
              key={repo.github_id}
              repo={repo}
              alreadyImported={importedNames.has(repo.full_name)}
              onImport={() => importMutation.mutate(repo.full_name)}
              pending={importMutation.isPending && importMutation.variables === repo.full_name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

interface ImportRowProps {
  repo: GitHubRepo;
  alreadyImported: boolean;
  onImport: () => void;
  pending: boolean;
}

function ImportRow({ repo, alreadyImported, onImport, pending }: ImportRowProps) {
  return (
    <Card className="flex items-center justify-between gap-4 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{repo.full_name}</span>
          {repo.private && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
          {repo.stars > 0 && (
            <span className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-xs">
              <Star className="size-3" />
              {repo.stars.toLocaleString()}
            </span>
          )}
        </div>
        {repo.description && (
          <p className="text-muted-foreground truncate text-xs">{repo.description}</p>
        )}
      </div>
      {alreadyImported ? (
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
          <Check className="size-3.5" /> Imported
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={onImport} disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Import
        </Button>
      )}
    </Card>
  );
}
