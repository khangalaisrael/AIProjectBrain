import { type ImportStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STYLES: Record<ImportStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  cloning: "bg-blue-500/15 text-blue-500",
  parsing: "bg-blue-500/15 text-blue-500",
  indexing: "bg-blue-500/15 text-blue-500",
  ready: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-red-500/15 text-red-500",
};

const LABELS: Record<ImportStatus, string> = {
  pending: "Pending",
  cloning: "Cloning",
  parsing: "Parsing",
  indexing: "Indexing",
  ready: "Ready",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: ImportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
