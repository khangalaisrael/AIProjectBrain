"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Lock, Plus, Search } from "lucide-react";

import { type GitHubRepo, type Repository } from "@/lib/api";
import { useGitHubRepositories, useImportRepository } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ImportPanelProps {
  imported: Repository[];
}

export function ImportPanel({ imported }: ImportPanelProps) {
  const { data: repos, isLoading, isError } = useGitHubRepositories(true);
  const importMutation = useImportRepository();
  const [query, setQuery] = useState("");

  const importedNames = useMemo(() => new Set(imported.map((r) => r.full_name)), [imported]);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.full_name.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-8 text-sm">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground">Loading your GitHub repositories…</span>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="text-muted-foreground p-6 text-sm">
        Couldn&apos;t load your GitHub repositories. Try refreshing the page.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/40 flex h-9 items-center gap-2 rounded-md border px-3">
        <Search className="text-muted-foreground size-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter repositories…"
          className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
        {filtered.map((repo) => (
          <ImportRow
            key={repo.github_id}
            repo={repo}
            alreadyImported={importedNames.has(repo.full_name)}
            onImport={() => importMutation.mutate(repo.full_name)}
            pending={importMutation.isPending && importMutation.variables === repo.full_name}
          />
        ))}
      </div>
    </div>
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
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{repo.full_name}</span>
        {repo.private && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
      </div>
      {alreadyImported ? (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
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
