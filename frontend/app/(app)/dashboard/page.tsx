"use client";

import Link from "next/link";
import { FolderGit2 } from "lucide-react";

import { useAuth, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SignInButton } from "@/components/auth/auth-controls";
import { RepoCard } from "@/components/dashboard/repo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useProgressStore } from "@/lib/progress-store";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { data: repositories, isLoading: reposLoading } = useRepositories(isAuthenticated);
  const done = useProgressStore((s) => s.done);
  const lessonsDone = Object.values(done).reduce((n, ids) => n + ids.length, 0);

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Sign in to import and learn from repositories."
        />
        <EmptyState
          icon={FolderGit2}
          title="Welcome to AI Project Brain"
          description="Connect your GitHub account to turn a repository into an interactive course."
          action={<SignInButton />}
        />
      </>
    );
  }

  const hasRepos = repositories && repositories.length > 0;

  return (
    <>
      <PageHeader
        title={user ? `Welcome back, ${user.username}` : "Dashboard"}
        description="Your imported repositories and their indexing status."
      />

      {reposLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : hasRepos ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Repositories" value={repositories.length} />
            <Stat label="Ready" value={repositories.filter((r) => r.status === "ready").length} />
            <Stat label="Lessons done" value={lessonsDone} />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your repositories</h2>
            <Link
              href="/repositories"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Manage
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {repositories.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FolderGit2}
          title="No repositories yet"
          description="Import a GitHub repository to generate an interactive course and start learning."
          action={
            <Link href="/repositories" className={buttonVariants()}>
              Import repository
            </Link>
          }
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </Card>
  );
}
