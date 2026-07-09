"use client";

import { FolderGit2 } from "lucide-react";

import { useAuth, useRepositories } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SignInButton } from "@/components/auth/auth-controls";
import { ImportPanel } from "@/components/repositories/import-panel";
import { ImportedList } from "@/components/repositories/imported-list";

export default function RepositoriesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: imported, isLoading } = useRepositories(isAuthenticated);

  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader
          title="Repositories"
          description="Connect GitHub and import repositories to analyze."
        />
        <EmptyState
          icon={FolderGit2}
          title="Connect GitHub"
          description="Sign in with GitHub to browse and import your repositories."
          action={<SignInButton />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Import a repository to analyze, or review ones you've already imported."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Import from GitHub</h2>
          <ImportPanel imported={imported ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Imported</h2>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : imported && imported.length > 0 ? (
            <ImportedList repositories={imported} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing imported yet. Pick a repository to get started.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
