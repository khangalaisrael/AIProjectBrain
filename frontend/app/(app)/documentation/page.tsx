import { FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function DocumentationPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="Generated README, API, architecture, class, and folder documentation."
      />
      <EmptyState
        icon={FileText}
        title="No documentation yet"
        description="Generated docs will appear here once a repository has been indexed."
      />
    </>
  );
}
