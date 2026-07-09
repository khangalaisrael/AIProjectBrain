import { Lightbulb } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function DeveloperThinkingPage() {
  return (
    <>
      <PageHeader
        title="Developer Thinking"
        description="Engineering intent behind key decisions: reasons, trade-offs, alternatives."
      />
      <EmptyState
        icon={Lightbulb}
        title="No insights yet"
        description="After analysis, inferred design decisions and their rationale will appear here."
      />
    </>
  );
}
