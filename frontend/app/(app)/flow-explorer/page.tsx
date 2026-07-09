import { Network } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function FlowExplorerPage() {
  return (
    <>
      <PageHeader
        title="Flow Explorer"
        description="Interactive request and data-flow diagrams with clickable nodes."
      />
      <EmptyState
        icon={Network}
        title="No flows yet"
        description="Request, data, and authentication flows will be generated after indexing."
      />
    </>
  );
}
