import { Settings } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Account, connected providers, and preferences." />
      <EmptyState
        icon={Settings}
        title="Settings coming soon"
        description="Account and integration settings will be configurable here."
      />
    </>
  );
}
