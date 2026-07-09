"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Clock,
  FolderTree,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Signal,
} from "lucide-react";

import { type Overview } from "@/lib/api";
import { useAuth, useGenerateOverview, useOverview, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/auth/auth-controls";

function formatMinutes(min: number | null): string {
  if (!min) return "—";
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

export default function OverviewPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  const overview = useOverview(repositoryId);
  const generate = useGenerateOverview();

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader title="Overview" description="A high-level summary of a project." />
        <EmptyState
          icon={Boxes}
          title="Sign in to see overviews"
          description="Connect GitHub and import a repository to generate a project overview."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader title="Overview" description="A high-level summary of a project." />
        <EmptyState
          icon={Boxes}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish to generate an overview."
        />
      </>
    );
  }

  const data = overview.data;
  const notGenerated = overview.isError && !data;

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <PageHeader title="Overview" description="A high-level summary of the project." />
        <div className="flex items-center gap-2">
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
          {data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => repositoryId !== null && generate.mutate(repositoryId)}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {overview.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {notGenerated && (
        <EmptyState
          icon={Sparkles}
          title="No overview yet"
          description="Generate an AI overview summarizing this project's purpose, stack, and architecture."
          action={
            <Button
              onClick={() => repositoryId !== null && generate.mutate(repositoryId)}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate overview
            </Button>
          }
        />
      )}

      {data && <OverviewContent data={data} />}
    </>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={Signal} label="Difficulty" value={data.difficulty ?? "—"} />
        <StatTile
          icon={Clock}
          label="Learning time"
          value={formatMinutes(data.learning_time_minutes)}
        />
        <StatTile icon={Layers} label="Architecture" value={data.architecture_style ?? "—"} />
      </div>

      {data.technologies.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Technologies</h3>
          <div className="flex flex-wrap gap-2">
            {data.technologies.map((t) => (
              <span
                key={t}
                className="border-border bg-muted/50 rounded-full border px-3 py-1 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {data.features.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Main features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {data.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {data.folder_map.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderTree className="size-4" /> Folder map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {data.folder_map.map((f) => (
                  <li key={f.folder} className="flex items-center justify-between">
                    <span className="font-mono">{f.folder}</span>
                    <span className="text-muted-foreground text-xs">{f.file_count} files</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-accent/15 text-accent flex size-9 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
