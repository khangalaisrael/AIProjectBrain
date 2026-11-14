"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { useAuth, useGenerateCourse, useLessons, useRepositories } from "@/lib/hooks";
import { PANEL } from "@/lib/panel-size-store";
import { useProgressStore } from "@/lib/progress-store";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useResizable } from "@/lib/use-resizable";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
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

  const lastRepoId = useProgressStore((s) => s.lastRepoId);
  const setLastRepo = useProgressStore((s) => s.setLastRepo);
  const setLastIndex = useProgressStore((s) => s.setLastIndex);
  const setDone = useProgressStore((s) => s.setDone);
  const doneMap = useProgressStore((s) => s.done);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (repositoryId === null && readyRepos.length > 0) {
      const remembered = readyRepos.find((r) => r.id === lastRepoId);
      setRepositoryId((remembered ?? readyRepos[0]).id);
    }
  }, [readyRepos, repositoryId, lastRepoId]);

  // Resume where the learner left off in this repository.
  useEffect(() => {
    if (repositoryId === null) return;
    setLastRepo(repositoryId);
    setActiveIndex(useProgressStore.getState().lastIndex[String(repositoryId)] ?? 0);
  }, [repositoryId, setLastRepo]);

  function goTo(index: number) {
    setActiveIndex(index);
    if (repositoryId !== null) setLastIndex(repositoryId, index);
    setPickerOpen(false);
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  const lessons = useLessons(repositoryId);
  const generate = useGenerateCourse();
  const nav = useResizable({ id: PANEL.learnNav, defaultWidth: 260, min: 180, max: 480 });

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
  const safeIndex = Math.min(activeIndex, Math.max(0, data.length - 1));
  const active = data[safeIndex];
  const doneIds = repositoryId !== null ? (doneMap[String(repositoryId)] ?? []) : [];
  const completedCount = data.filter((l) => doneIds.includes(l.id)).length;
  const isDone = active ? doneIds.includes(active.id) : false;
  const isLast = safeIndex === data.length - 1;
  const progressPct = data.length > 0 ? (completedCount / data.length) * 100 : 0;

  const lessonList = (
    <ol className="space-y-1">
      {data.map((lesson, i) => {
        const done = doneIds.includes(lesson.id);
        return (
          <li key={lesson.id}>
            <button
              onClick={() => goTo(i)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-2.5 text-left text-sm transition-colors lg:py-2",
                i === safeIndex
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 className="mt-px size-4 shrink-0 text-emerald-500" />
              ) : (
                <span className="text-muted-foreground w-4 shrink-0 text-center text-xs">
                  {i + 1}
                </span>
              )}
              <span>{lesson.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-8rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <PageHeader title="Learn" description="A structured course generated from the codebase." />
        <div className="flex items-center gap-2">
          <select
            value={repositoryId ?? ""}
            onChange={(e) => setRepositoryId(Number(e.target.value))}
            className="border-border bg-background text-foreground h-9 max-w-full min-w-0 rounded-md border px-2 text-sm"
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
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
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
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0">
          {/* Mobile: current lesson + progress, opens a bottom sheet */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="border-border bg-card flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  Lesson {safeIndex + 1} of {data.length} · {completedCount} done
                </p>
                <p className="truncate text-sm font-medium">{active?.title}</p>
              </div>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </button>
            <ProgressBar value={progressPct} className="mt-2" />
          </div>
          <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Lessons">
            {lessonList}
          </BottomSheet>

          {/* Desktop: lesson navigation */}
          <nav
            style={{ "--panel-w": `${nav.width}px` } as React.CSSProperties}
            className="border-border hidden min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border lg:flex lg:w-[var(--panel-w)]"
          >
            <div className="border-border shrink-0 border-b p-3">
              <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
                <span>Progress</span>
                <span>
                  {completedCount}/{data.length}
                </span>
              </div>
              <ProgressBar value={progressPct} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">{lessonList}</div>
          </nav>

          <ResizeHandle
            {...nav.separatorProps}
            isDragging={nav.isDragging}
            className="hidden lg:block"
          />

          {/* Lesson content */}
          <article className="border-border min-h-0 min-w-0 flex-1 rounded-lg border lg:overflow-y-auto">
            {active && (
              <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
                <div className="border-border mb-4 border-b pb-4">
                  <p className="text-muted-foreground text-xs">
                    Lesson {safeIndex + 1} of {data.length}
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
                    onClick={() => goTo(Math.max(0, safeIndex - 1))}
                    disabled={safeIndex === 0}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (repositoryId !== null) setDone(repositoryId, active.id, true);
                      if (!isLast) goTo(safeIndex + 1);
                    }}
                  >
                    {isDone && !isLast ? (
                      <>
                        Next <ChevronRight className="size-4" />
                      </>
                    ) : isLast ? (
                      <>
                        <Check className="size-4" /> {isDone ? "Completed" : "Finish course"}
                      </>
                    ) : (
                      <>
                        <Check className="size-4" /> Complete &amp; next
                      </>
                    )}
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
