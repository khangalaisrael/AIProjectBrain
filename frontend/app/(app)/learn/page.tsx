"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { useAuth, useGenerateCourse, useLessons, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/auth-controls";
import { Markdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";

function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export default function LearnPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const readyRepos = useMemo(
    () => (repositories ?? []).filter((r) => r.status === "ready"),
    [repositories],
  );

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) setRepositoryId(readyRepos[0].id);
  }, [readyRepos, repositoryId]);

  useEffect(() => {
    setActiveIndex(0);
  }, [repositoryId]);

  const lessons = useLessons(repositoryId);
  const generate = useGenerateCourse();

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader title="Learn" description="A structured course generated from the codebase." />
        <EmptyState
          icon={BookOpen}
          title="Sign in to learn"
          description="Connect GitHub and import a repository to generate an interactive course."
          action={<SignInButton />}
        />
      </>
    );
  }

  if (readyRepos.length === 0) {
    return (
      <>
        <PageHeader title="Learn" description="A structured course generated from the codebase." />
        <EmptyState
          icon={BookOpen}
          title="No indexed repositories"
          description="Import a repository and wait for indexing to finish to generate a course."
        />
      </>
    );
  }

  const data = lessons.data ?? [];
  const hasCourse = data.length > 0;
  const active = data[activeIndex];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PageHeader title="Learn" description="A structured course generated from the codebase." />
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
          {hasCourse && (
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

      {lessons.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !hasCourse ? (
        <EmptyState
          icon={Sparkles}
          title="No course yet"
          description="Generate a structured course that teaches how this project is built, module by module."
          action={
            <Button
              onClick={() => repositoryId !== null && generate.mutate(repositoryId)}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating course…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate course
                </>
              )}
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Lesson navigation */}
          <nav className="border-border min-h-0 overflow-y-auto rounded-lg border p-2">
            <ol className="space-y-1">
              {data.map((lesson, i) => (
                <li key={lesson.id}>
                  <button
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      i === activeIndex
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="text-muted-foreground w-5 shrink-0 text-xs">{i + 1}</span>
                    <span>{lesson.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {/* Lesson content */}
          <article className="border-border min-h-0 overflow-y-auto rounded-lg border">
            {active && (
              <div className="mx-auto max-w-3xl px-6 py-6">
                <div className="border-border mb-4 border-b pb-4">
                  <p className="text-muted-foreground text-xs">
                    Lesson {activeIndex + 1} of {data.length}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{active.title}</h1>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5" /> {readingTime(active.content)}
                  </p>
                </div>

                <Markdown>{active.content}</Markdown>

                <div className="border-border mt-8 flex items-center justify-between border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveIndex((i) => Math.min(data.length - 1, i + 1))}
                    disabled={activeIndex === data.length - 1}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
