"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, FileCode2, Lock, Map as MapIcon } from "lucide-react";

import { type Repository } from "@/lib/api";
import { useLessons } from "@/lib/hooks";
import { useProgressStore } from "@/lib/progress-store";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/repositories/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANG_DOT: Record<string, string> = {
  Python: "bg-yellow-400",
  TypeScript: "bg-blue-500",
  JavaScript: "bg-amber-400",
  Go: "bg-cyan-400",
  Rust: "bg-orange-500",
  Java: "bg-red-500",
  "C#": "bg-green-500",
  Ruby: "bg-rose-500",
};

export function RepoCard({ repo }: { repo: Repository }) {
  const router = useRouter();
  const ready = repo.status === "ready";
  const lessons = useLessons(ready ? repo.id : null);
  const done = useProgressStore((s) => s.done[String(repo.id)] ?? []);
  const lastIndex = useProgressStore((s) => s.lastIndex[String(repo.id)] ?? 0);
  const setLastRepo = useProgressStore((s) => s.setLastRepo);

  const total = lessons.data?.length ?? 0;
  const completed = lessons.data ? lessons.data.filter((l) => done.includes(l.id)).length : 0;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const hasCourse = total > 0;

  function goLearn() {
    setLastRepo(repo.id);
    router.push("/learn");
  }

  return (
    <Card className="flex flex-col gap-4 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{repo.name}</span>
            {repo.is_private && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{repo.full_name}</p>
        </div>
        <StatusBadge status={repo.status} />
      </div>

      <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm">
        {repo.description ?? "No description."}
      </p>

      {repo.status === "failed" && repo.error_message && (
        <p className="truncate text-xs text-red-500">{repo.error_message}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        {repo.language ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className={cn("size-2 rounded-full", LANG_DOT[repo.language] ?? "bg-zinc-400")} />
            {repo.language}
          </span>
        ) : (
          <span />
        )}

        {ready &&
          (lessons.isLoading ? (
            <Skeleton className="size-12 rounded-full" />
          ) : hasCourse ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {completed}/{total} lessons
              </span>
              <ProgressRing value={pct} size={44} />
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">No course yet</span>
          ))}
      </div>

      {ready && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={goLearn} className={buttonVariants({ size: "sm" })}>
            <BookOpen className="size-3.5" />
            {completed > 0 && completed < total
              ? `Continue (lesson ${Math.min(lastIndex + 1, total)})`
              : completed === total && hasCourse
                ? "Review course"
                : "Start learning"}
            <ArrowRight className="size-3.5" />
          </button>
          <Link
            href="/code-explorer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileCode2 className="size-3.5" /> Explore
          </Link>
          <Link href="/atlas" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MapIcon className="size-3.5" /> Atlas
          </Link>
        </div>
      )}
    </Card>
  );
}
