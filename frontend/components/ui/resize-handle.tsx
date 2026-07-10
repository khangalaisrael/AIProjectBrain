"use client";

import { type SeparatorProps } from "@/lib/use-resizable";
import { cn } from "@/lib/utils";

interface ResizeHandleProps extends SeparatorProps {
  isDragging?: boolean;
  className?: string;
}

/**
 * A thin vertical divider you can grab. The hit area is comfortably wide while
 * the visible line stays a hairline until hovered or dragged.
 */
export function ResizeHandle({ isDragging, className, ...separatorProps }: ResizeHandleProps) {
  return (
    <div
      {...separatorProps}
      title="Drag to resize · double-click to reset"
      className={cn(
        "group relative w-2 shrink-0 cursor-col-resize touch-none select-none",
        "focus-visible:outline-none",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150",
          "bg-border group-hover:bg-accent/70 group-focus-visible:bg-accent",
          isDragging && "bg-accent",
        )}
      />
    </div>
  );
}
