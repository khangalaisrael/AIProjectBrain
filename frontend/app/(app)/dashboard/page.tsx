"use client";

import Link from "next/link";
import { FolderGit2 } from "lucide-react";

import { useAuth, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SignInButton } from "@/components/auth/auth-controls";
import { ImportedList } from "@/components/repositories/imported-list";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { data: repositories } = useRepositories(isAuthenticated);

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

      {hasRepos ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent repositories</h2>
            <Link
              href="/repositories"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Manage
            </Link>
          </div>
          <ImportedList repositories={repositories.slice(0, 5)} />
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
