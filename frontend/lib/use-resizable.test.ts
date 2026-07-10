import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePanelSizeStore } from "@/lib/panel-size-store";
import { useResizable } from "@/lib/use-resizable";

const ID = "test.panel";
const OPTIONS = { id: ID, defaultWidth: 200, min: 100, max: 400 } as const;

/**
 * jsdom implements neither PointerEvent nor pointer capture, so the handlers are
 * driven with a stub carrying only the fields `useResizable` reads.
 */
function pointerEvent(clientX: number) {
  return {
    clientX,
    pointerId: 1,
    preventDefault: vi.fn(),
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  } as unknown as React.PointerEvent<HTMLElement>;
}

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>;
}

/** Drag from `from` to `to`, releasing the pointer. */
function drag(
  separatorProps: ReturnType<typeof useResizable>["separatorProps"],
  from: number,
  to: number,
) {
  act(() => separatorProps.onPointerDown(pointerEvent(from)));
  act(() => separatorProps.onPointerMove(pointerEvent(to)));
  act(() => separatorProps.onPointerUp(pointerEvent(to)));
}

const storedWidth = () => usePanelSizeStore.getState().widths[ID];

beforeEach(() => {
  localStorage.clear();
  usePanelSizeStore.setState({ widths: {}, hydrated: false });
});

describe("useResizable", () => {
  it("starts at defaultWidth so server and first client render agree", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    expect(result.current.width).toBe(200);
    expect(result.current.isDragging).toBe(false);
  });

  it("clamps setWidth to max", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.setWidth(9999));
    expect(result.current.width).toBe(400);
    expect(storedWidth()).toBe(400);
  });

  it("clamps setWidth to min", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.setWidth(-50));
    expect(result.current.width).toBe(100);
    expect(storedWidth()).toBe(100);
  });

  it("exposes the current width on the separator for assistive tech", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    expect(result.current.separatorProps["aria-valuenow"]).toBe(200);
    expect(result.current.separatorProps["aria-valuemin"]).toBe(100);
    expect(result.current.separatorProps["aria-valuemax"]).toBe(400);
  });

  describe('edge="right"', () => {
    it("grows on ArrowRight and shrinks on ArrowLeft by one step", () => {
      const { result } = renderHook(() => useResizable(OPTIONS));
      act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowRight")));
      expect(result.current.width).toBe(216);
      act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowLeft")));
      expect(result.current.width).toBe(200);
    });

    it("adds the pointer delta while dragging", () => {
      const { result } = renderHook(() => useResizable(OPTIONS));
      drag(result.current.separatorProps, 100, 150);
      expect(result.current.width).toBe(250);
    });
  });

  describe('edge="left"', () => {
    const LEFT = { ...OPTIONS, edge: "left" } as const;

    it("grows on ArrowLeft and shrinks on ArrowRight", () => {
      const { result } = renderHook(() => useResizable(LEFT));
      act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowLeft")));
      expect(result.current.width).toBe(216);
      act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowRight")));
      expect(result.current.width).toBe(200);
    });

    it("subtracts the pointer delta while dragging", () => {
      const { result } = renderHook(() => useResizable(LEFT));
      drag(result.current.separatorProps, 100, 150);
      expect(result.current.width).toBe(150);
    });
  });

  it("ignores keys other than the two arrows on its axis", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowUp")));
    expect(result.current.width).toBe(200);
    expect(storedWidth()).toBeUndefined();
  });

  it("persists a clamped width on arrow-key resize", () => {
    const { result } = renderHook(() => useResizable({ ...OPTIONS, defaultWidth: 395 }));
    act(() => result.current.separatorProps.onKeyDown(keyEvent("ArrowRight")));
    // 395 + 16 = 411, past the 400 max.
    expect(result.current.width).toBe(400);
    expect(storedWidth()).toBe(400);
  });

  it("captures the pointer on press and toggles isDragging", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    const down = pointerEvent(100);
    act(() => result.current.separatorProps.onPointerDown(down));
    expect(result.current.isDragging).toBe(true);
    expect(down.currentTarget.setPointerCapture).toHaveBeenCalledWith(1);

    act(() => result.current.separatorProps.onPointerUp(pointerEvent(100)));
    expect(result.current.isDragging).toBe(false);
  });

  it("does not move before the pointer goes down", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.separatorProps.onPointerMove(pointerEvent(500)));
    expect(result.current.width).toBe(200);
  });

  it("commits the dragged width to the store only on release", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.separatorProps.onPointerDown(pointerEvent(100)));
    act(() => result.current.separatorProps.onPointerMove(pointerEvent(150)));
    expect(storedWidth()).toBeUndefined();

    act(() => result.current.separatorProps.onPointerUp(pointerEvent(150)));
    expect(storedWidth()).toBe(250);
  });

  it("clamps a drag that overshoots the max", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    drag(result.current.separatorProps, 0, 1000);
    expect(result.current.width).toBe(400);
    expect(storedWidth()).toBe(400);
  });

  it("restores the default width on double-click and forgets the stored one", () => {
    const { result } = renderHook(() => useResizable(OPTIONS));
    act(() => result.current.setWidth(320));
    expect(storedWidth()).toBe(320);

    act(() => result.current.separatorProps.onDoubleClick());
    expect(result.current.width).toBe(200);
    expect(storedWidth()).toBeUndefined();
  });

  it("keeps the default width until the persisted store has rehydrated", () => {
    usePanelSizeStore.setState({ widths: { [ID]: 300 }, hydrated: false });
    const { result } = renderHook(() => useResizable(OPTIONS));
    expect(result.current.width).toBe(200);

    act(() => usePanelSizeStore.setState({ hydrated: true }));
    expect(result.current.width).toBe(300);
  });

  it("clamps a persisted width that no longer fits the current bounds", () => {
    usePanelSizeStore.setState({ widths: { [ID]: 9999 }, hydrated: true });
    const { result } = renderHook(() => useResizable(OPTIONS));
    expect(result.current.width).toBe(400);
  });
});
