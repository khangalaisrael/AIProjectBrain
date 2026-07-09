import { FolderGit2, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your recent repositories, learning progress, and activity."
      />
      <EmptyState
        icon={FolderGit2}
        title="No repositories yet"
        description="Import a GitHub repository to generate an interactive course and start learning."
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
