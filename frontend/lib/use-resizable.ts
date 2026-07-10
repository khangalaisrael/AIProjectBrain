"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePanelSizeStore } from "@/lib/panel-size-store";

/** How far one arrow-key press nudges a divider. */
const KEY_STEP = 16;

interface Options {
  /** Stable id — the width is persisted under this key. */
  id: string;
  defaultWidth: number;
  min: number;
  max: number;
  /**
   * Which edge the handle sits on, relative to the panel it sizes.
   * "right": panel is left of the handle, dragging right grows it.
   * "left":  panel is right of the handle, dragging left grows it.
   */
  edge?: "left" | "right";
}

export interface SeparatorProps {
  role: "separator";
  "aria-orientation": "vertical";
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  tabIndex: 0;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

/**
 * Drag-to-resize a panel, remembering its width across reloads.
 *
 * The width lives in React state while dragging (so it tracks the pointer at
 * 60fps) and is committed to the persisted store on release.
 */
export function useResizable({ id, defaultWidth, min, max, edge = "right" }: Options) {
  const stored = usePanelSizeStore((s) => s.widths[id]);
  const hydrated = usePanelSizeStore((s) => s.hydrated);
  const commit = usePanelSizeStore((s) => s.setWidth);
  const reset = usePanelSizeStore((s) => s.resetWidth);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  // Always start from the default so server and first client render agree.
  const [width, setWidthState] = useState(defaultWidth);
  const widthRef = useRef(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);

  /** Set the width without persisting — used while the pointer is moving. */
  const applyWidth = useCallback(
    (value: number) => {
      const next = clamp(value);
      widthRef.current = next;
      setWidthState(next);
    },
    [clamp],
  );

  // Adopt the persisted width once localStorage has rehydrated.
  useEffect(() => {
    if (hydrated && typeof stored === "number") applyWidth(stored);
  }, [hydrated, stored, applyWidth]);

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    startX.current = event.clientX;
    startWidth.current = widthRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
    // Stop the drag from selecting text across the page.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragging.current) return;
      const delta = event.clientX - startX.current;
      applyWidth(startWidth.current + (edge === "right" ? delta : -delta));
    },
    [edge, applyWidth],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      commit(id, widthRef.current);
    },
    [commit, id],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const towardsGrowth = edge === "right" ? "ArrowRight" : "ArrowLeft";
      const towardsShrink = edge === "right" ? "ArrowLeft" : "ArrowRight";
      if (event.key !== towardsGrowth && event.key !== towardsShrink) return;
      event.preventDefault();
      const next = widthRef.current + (event.key === towardsGrowth ? KEY_STEP : -KEY_STEP);
      applyWidth(next);
      commit(id, clamp(next));
    },
    [edge, applyWidth, commit, id, clamp],
  );

  /** Double-clicking a divider snaps the panel back to its default width. */
  const onDoubleClick = useCallback(() => {
    applyWidth(defaultWidth);
    reset(id);
  }, [defaultWidth, reset, id, applyWidth]);

  /** Set the width and remember it — for buttons that jump to a preset size. */
  const setWidth = useCallback(
    (value: number) => {
      applyWidth(value);
      commit(id, clamp(value));
    },
    [applyWidth, commit, id, clamp],
  );

  const separatorProps: SeparatorProps = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-valuenow": Math.round(width),
    "aria-valuemin": min,
    "aria-valuemax": max,
    tabIndex: 0,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onDoubleClick,
    onKeyDown,
  };

  return { width, isDragging, separatorProps, setWidth };
}
