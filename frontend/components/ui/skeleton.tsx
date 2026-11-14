import { cn } from "@/lib/utils";

/** A pulsing placeholder block shown while content loads. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn("bg-muted animate-pulse rounded-md", className)}
    />
  );
}
