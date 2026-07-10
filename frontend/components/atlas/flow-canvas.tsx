"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from "@xyflow/react";
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw } from "lucide-react";

import "@xyflow/react/dist/base.css";

import { type FlowStep } from "@/lib/api";
import { useExplainFlow, useFlowPath, useFlows } from "@/lib/hooks";
import { AtlasEdge, type AtlasEdgeData } from "@/components/atlas/atlas-edge";
import { FlowNode, type FlowNodeData, type FlowNodeState } from "@/components/atlas/flow-node";
import { FlowStepPanel } from "@/components/atlas/flow-step-panel";
import { layoutFlow, type PositionedStep } from "@/components/atlas/elk-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const nodeTypes = { flow: FlowNode };
const edgeTypes = { atlas: AtlasEdge };

const SPEEDS = [
  { label: "0.5×", ms: 2600 },
  { label: "1×", ms: 1400 },
  { label: "2×", ms: 700 },
];

interface FlowCanvasProps {
  repositoryId: number;
}

export function FlowCanvas(props: FlowCanvasProps) {
  // The camera hooks need a provider that is not shared with the Atlas map.
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({ repositoryId }: FlowCanvasProps) {
  const { setCenter, fitView } = useReactFlow();

  const { data: entries, isLoading: entriesLoading } = useFlows(repositoryId);
  const [entryKey, setEntryKey] = useState<string | null>(null);

  useEffect(() => {
    if (entryKey === null && entries && entries.length > 0) setEntryKey(entries[0].key);
  }, [entries, entryKey]);

  const { data: flow, isLoading: pathLoading } = useFlowPath(repositoryId, entryKey);
  const explain = useExplainFlow();

  const [positioned, setPositioned] = useState<PositionedStep[]>([]);
  const [laidOutFor, setLaidOutFor] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1].ms);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepCount = flow?.steps.length ?? 0;

  // Lay the trace out whenever a different request is selected.
  useEffect(() => {
    let cancelled = false;
    if (!flow) return;

    setLaidOutFor(null);
    setCurrent(0);
    setPlaying(false);
    explain.reset();

    layoutFlow(flow).then((laid) => {
      if (cancelled) return;
      setPositioned(laid);
      setLaidOutFor(flow.entry_key);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  useEffect(() => {
    if (laidOutFor && positioned.length > 0) fitView({ duration: 500, maxZoom: 1 });
  }, [laidOutFor, positioned, fitView]);

  /** Glide the camera onto the frame the request is currently in. */
  useEffect(() => {
    const target = positioned.find((p) => p.key === flow?.steps[current]?.key);
    if (!target) return;
    setCenter(target.x + target.width / 2, target.y + target.height / 2, {
      zoom: 1.1,
      duration: 600,
    });
  }, [current, positioned, flow, setCenter]);

  // Playback: advance one frame at a time, stopping at the end.
  useEffect(() => {
    if (!playing) return;
    if (current >= stepCount - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setCurrent((i) => i + 1), speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, current, stepCount, speed]);

  const restart = useCallback(() => {
    setCurrent(0);
    setPlaying(false);
  }, []);

  const stepState = useCallback(
    (index: number): FlowNodeState =>
      index === current ? "active" : index < current ? "visited" : "future",
    [current],
  );

  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    flow?.steps.forEach((s, i) => map.set(s.key, i));
    return map;
  }, [flow]);

  const nodes: Node[] = useMemo(
    () =>
      positioned.map((p) => {
        const index = indexOf.get(p.key) ?? 0;
        const step = flow!.steps[index];
        return {
          id: p.key,
          type: "flow",
          position: { x: p.x, y: p.y },
          width: p.width,
          height: p.height,
          data: {
            index,
            name: step.name,
            file: (step.path ?? "").split("/").pop() ?? "",
            state: stepState(index),
          } satisfies FlowNodeData,
        };
      }),
    [positioned, indexOf, flow, stepState],
  );

  const edges: Edge[] = useMemo(
    () =>
      (flow?.edges ?? []).map((e, i) => {
        const targetIndex = indexOf.get(e.target_key) ?? Infinity;
        // An edge is "live" once the request has reached what it points at.
        const traversed = targetIndex <= current;
        return {
          id: `fe-${i}`,
          source: e.source_key,
          target: e.target_key,
          type: "atlas",
          data: {
            kind: "calls",
            weight: 1,
            state: targetIndex === current ? "active" : traversed ? "normal" : "dim",
          } satisfies AtlasEdgeData,
        };
      }),
    [flow, indexOf, current],
  );

  const activeStep: FlowStep | null = flow?.steps[current] ?? null;
  const settling = pathLoading || (flow && laidOutFor !== flow.entry_key);

  if (entriesLoading) {
    return <p className="text-muted-foreground text-sm">Finding request entry points…</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={Play}
        title="No request entry points found"
        description="Request Flow needs route handlers and resolved call edges. Re-index this repository, or it may simply not expose an HTTP API."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="border-border rounded-card relative min-w-0 flex-1 overflow-hidden border">
        {/* Entry point picker + transport controls */}
        <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-center gap-2">
          <select
            value={entryKey ?? ""}
            onChange={(e) => setEntryKey(e.target.value)}
            className="border-border bg-card/90 text-foreground h-9 max-w-xs rounded-full border px-3 text-xs backdrop-blur"
          >
            {entries.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.name} — {(entry.path ?? "").split("/").pop()}
              </option>
            ))}
          </select>

          <div className="border-border bg-card/90 flex items-center gap-1 rounded-full border px-2 py-1 backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              onClick={restart}
              aria-label="Restart"
              disabled={!stepCount}
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrent((i) => Math.max(0, i - 1))}
              disabled={current === 0}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPlaying((p) => !p)}
              disabled={stepCount <= 1}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrent((i) => Math.min(stepCount - 1, i + 1))}
              disabled={current >= stepCount - 1}
              aria-label="Next step"
            >
              <ChevronRight className="size-4" />
            </Button>

            <span className="text-muted-foreground px-2 text-[10px] tabular-nums">
              {stepCount ? `${current + 1} / ${stepCount}` : "—"}
            </span>

            <div className="border-border ml-1 flex items-center gap-0.5 border-l pl-1">
              {SPEEDS.map((s) => (
                <button
                  key={s.ms}
                  onClick={() => setSpeed(s.ms)}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] transition-colors",
                    speed === s.ms
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {settling && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => {
            const index = indexOf.get(node.id);
            if (index !== undefined) {
              setPlaying(false);
              setCurrent(index);
            }
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          zoomOnDoubleClick={false}
          minZoom={0.3}
          maxZoom={2}
          className="bg-background"
        />
      </div>

      <FlowStepPanel
        repositoryId={repositoryId}
        step={activeStep}
        explanation={explain.data}
        isExplaining={explain.isPending}
        onExplain={() => entryKey && explain.mutate({ repositoryId, key: entryKey })}
        className="w-96 shrink-0"
      />
    </div>
  );
}
