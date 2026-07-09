import { Boxes } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Project summary, technologies, architecture, and estimated learning time."
      />
      <EmptyState
        icon={Boxes}
        title="No project selected"
        description="Import and index a repository to see its high-level overview here."
      />
    </>
  );
}
