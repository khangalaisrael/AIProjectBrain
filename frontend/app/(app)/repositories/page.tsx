import { FolderGit2, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RepositoriesPage() {
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
        action={
          <Button>
            <Plus className="size-4" />
            Import repository
          </Button>
        }
      />
    </>
  );
}
