import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Guidance-first empty state, per the UI/UX spec: every page answers
 * "Where am I / What can I do / What next".
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
