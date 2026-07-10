"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { type FlowExplanation, type FlowStep } from "@/lib/api";
import { useFile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { CodeViewer } from "@/components/explorer/code-viewer";
import { cn } from "@/lib/utils";

interface FlowStepPanelProps {
  repositoryId: number;
  step: FlowStep | null;
  explanation: FlowExplanation | undefined;
  isExplaining: boolean;
  onExplain: () => void;
  className?: string;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">
      {children}
    </p>
  );
}

export function FlowStepPanel({
  repositoryId,
  step,
  explanation,
  isExplaining,
  onExplain,
  className,
}: FlowStepPanelProps) {
  const { data: file, isLoading } = useFile(
    step?.file_id ? repositoryId : null,
    step?.file_id ?? null,
  );

  // Show only the lines belonging to this step, not the whole file.
  const snippet = useMemo(() => {
    if (!file || !step?.start_line) return null;
    const lines = file.content.split("\n");
    const from = Math.max(0, step.start_line - 1);
    const to = step.end_line ?? step.start_line;
    return lines.slice(from, to).join("\n");
  }, [file, step]);

  const stepExplanation = explanation?.steps.find((s) => s.key === step?.key)?.explanation;

  return (
    <aside
      className={cn(
        "border-border/70 bg-background/95 rounded-card flex min-h-0 flex-col border backdrop-blur",
        className,
      )}
    >
      {step ? (
        <>
          <div className="border-border shrink-0 border-b p-4">
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Step {step.depth === 0 ? "· entry point" : `· depth ${step.depth}`}
            </p>
            <h3 className="truncate font-mono text-sm font-semibold">{step.name}</h3>
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
              {step.path}
              {step.start_line ? `:${step.start_line}` : ""}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {/* Narrative for the whole request. */}
            {explanation?.summary && (
              <div>
                <SectionHeading>This request</SectionHeading>
                <p className="text-sm leading-relaxed">{explanation.summary}</p>
              </div>
            )}

            <div>
              <SectionHeading>Why this step</SectionHeading>
              {stepExplanation ? (
                <motion.p
                  key={step.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm leading-relaxed"
                >
                  {stepExplanation}
                </motion.p>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onExplain}
                  disabled={isExplaining}
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Narrating the request…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> Explain this flow
                    </>
                  )}
                </Button>
              )}
            </div>

            <div>
              <SectionHeading>Source</SectionHeading>
              {isLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-3.5 animate-spin" /> Loading source…
                </div>
              ) : snippet ? (
                <div className="border-border max-h-72 overflow-auto rounded-md border">
                  <CodeViewer
                    content={snippet}
                    language={file?.language ?? null}
                    startLine={step.start_line ?? 1}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No source for this step.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground p-6 text-center text-sm">
          Pick a request to replay it.
        </p>
      )}
    </aside>
  );
}
