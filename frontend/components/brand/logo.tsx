import { cn } from "@/lib/utils";

/**
 * The Project Brain mark: a small knowledge graph (three linked nodes, one
 * highlighted) on a teal tile. It echoes the Atlas map that is the heart of the product.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={cn("size-7 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="11" fill="#0f766e" />
      <g stroke="#99f6e4" strokeWidth="2.6" strokeLinecap="round">
        <path d="M14 33 24 15" />
        <path d="M24 15 35 32" />
        <path d="M14 33h21" />
      </g>
      <circle cx="14" cy="33" r="4.6" fill="#ccfbf1" />
      <circle cx="35" cy="32" r="4.6" fill="#ccfbf1" />
      <circle cx="24" cy="15" r="5.4" fill="#fb7185" />
    </svg>
  );
}
