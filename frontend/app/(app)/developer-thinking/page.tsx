"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Lightbulb, Loader2, RefreshCw, Scale, Sparkles } from "lucide-react";

import { type Decision } from "@/lib/api";
import { useAuth, useDecisions, useGenerateDecisions, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/auth/auth-controls";

export default function DeveloperThinkingPage() {
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

  const decisions = useDecisions(repositoryId);
  const generate = useGenerateDecisions();

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader
          title="Developer Thinking"
          description="The engineering decisions behind the project, and why."
        />
        <EmptyState
          icon={Lightbulb}
          title="Sign in to see the reasoning"
          description="Connect GitHub and import a repository to infer its design decisions."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader
          title="Developer Thinking"
          description="The engineering decisions behind the project, and why."
        />
        <EmptyState
          icon={Lightbulb}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish to infer its decisions."
        />
      </>
    );
  }

  const data = decisions.data ?? [];
  const hasDecisions = data.length > 0;

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <PageHeader
          title="Developer Thinking"
          description="The engineering decisions behind the project, and why."
        />
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
          {hasDecisions && (
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

      {decisions.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !hasDecisions ? (
        <EmptyState
          icon={Sparkles}
          title="No decisions inferred yet"
          description="Analyze this project to surface its key engineering decisions, their reasons, trade-offs, and alternatives."
          action={
            <Button
              onClick={() => repositoryId !== null && generate.mutate(repositoryId)}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Infer decisions
                </>
              )}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.map((item) => (
            <DecisionCard key={item.id} decision={item} />
          ))}
        </div>
      )}
    </>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-base">
          <Lightbulb className="text-accent mt-0.5 size-4 shrink-0" />
          <span>{decision.decision}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section label="Reason" icon={Lightbulb} text={decision.reason} />
        {decision.tradeoffs && (
          <Section label="Trade-offs" icon={Scale} text={decision.tradeoffs} />
        )}
        {decision.alternatives && (
          <Section label="Alternatives" icon={GitBranch} text={decision.alternatives} />
        )}
      </CardContent>
    </Card>
  );
}

function Section({ label, icon: Icon, text }: { label: string; icon: typeof Scale; text: string }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}
