import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Learn"
        description="A structured course automatically generated from the codebase."
      />
      <EmptyState
        icon={BookOpen}
        title="No course yet"
        description="Once a repository is indexed, a step-by-step learning path will appear here."
      />
    </>
  );
}
