import { FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function CodeExplorerPage() {
  return (
    <>
      <PageHeader
        title="Code Explorer"
        description="Browse files and functions with contextual AI explanations."
      />
      <EmptyState
        icon={FileText}
        title="Nothing to explore yet"
        description="Import a repository to browse its files, classes, and functions with explanations."
      />
    </>
  );
}
