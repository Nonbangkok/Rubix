import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HUD_LAYOUT } from "./defaults";
import type { HudLayout } from "./types";

const saveHudLayout = vi.fn();
const clearHudLayout = vi.fn();

vi.mock("./storage", () => ({
  saveHudLayout: (layout: HudLayout) => saveHudLayout(layout),
  clearHudLayout: () => clearHudLayout(),
}));

const { createEditorState, editorReducer, selectShowReset } = await import("./editorReducer");

const viewport = { width: 1000, height: 800 };

function withLayout(overrides: Partial<HudLayout>): HudLayout {
  return { ...DEFAULT_HUD_LAYOUT, ...overrides };
}

beforeEach(() => {
  saveHudLayout.mockClear();
  clearHudLayout.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createEditorState", () => {
  it("starts outside edit mode with a private copy of the supplied layout", () => {
    const state = createEditorState(DEFAULT_HUD_LAYOUT);
    expect(state.editing).toBe(false);
    expect(state.interaction).toBeNull();
    expect(state.layout).toEqual(DEFAULT_HUD_LAYOUT);
    expect(state.layout).not.toBe(DEFAULT_HUD_LAYOUT);
  });
});

describe("TOGGLE_EDIT", () => {
  it("enters edit mode when editing is enabled", () => {
    const state = createEditorState(DEFAULT_HUD_LAYOUT, false);
    const next = editorReducer(state, { type: "TOGGLE_EDIT" });
    expect(next.editing).toBe(true);
  });

  it("is a no-op entry while editing is disabled", () => {
    const state = createEditorState(DEFAULT_HUD_LAYOUT, true);
    const next = editorReducer(state, { type: "TOGGLE_EDIT" });
    expect(next).toBe(state);
    expect(next.editing).toBe(false);
  });

  it("exits edit mode and clears any interaction", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const dragging = editorReducer(editing, {
      type: "START_DRAG",
      item: "timer",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    const next = editorReducer(dragging, { type: "TOGGLE_EDIT" });
    expect(next.editing).toBe(false);
    expect(next.interaction).toBeNull();
  });
});

describe("SET_DISABLED", () => {
  it("forces edit mode off and clears interaction when disabled becomes true", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const dragging = editorReducer(editing, {
      type: "START_DRAG",
      item: "timer",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    const next = editorReducer(dragging, { type: "SET_DISABLED", disabled: true });
    expect(next.disabled).toBe(true);
    expect(next.editing).toBe(false);
    expect(next.interaction).toBeNull();
  });
});

describe("panel dragging", () => {
  it("updates only the selected item's rectangle", () => {
    // Placed away from every snap candidate so the plain drag delta survives.
    const layout = withLayout({ timer: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_DRAG",
      item: "timer",
      clientX: 500,
      clientY: 400,
      viewport,
    });
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 520,
      clientY: 416,
      viewport,
    });

    expect(moved.layout.timer).not.toEqual(layout.timer);
    expect(moved.layout.timer.x).toBeCloseTo(0.42);
    expect(moved.layout.timer.y).toBeCloseTo(0.42);
    expect(moved.layout.timer.width).toBe(layout.timer.width);
    expect(moved.layout.timer.height).toBe(layout.timer.height);

    expect(moved.layout.sidebar).toBe(editing.layout.sidebar);
    expect(moved.layout.cube).toBe(editing.layout.cube);
    expect(moved.layout.leftZone).toBe(editing.layout.leftZone);
    expect(moved.layout.rightZone).toBe(editing.layout.rightZone);
  });

  it("ignores drag starts while not editing", () => {
    const state = createEditorState(DEFAULT_HUD_LAYOUT);
    const next = editorReducer(state, {
      type: "START_DRAG",
      item: "timer",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    expect(next).toBe(state);
    expect(next.interaction).toBeNull();
  });

  it("ignores pointer moves when there is no active interaction", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const next = editorReducer(editing, {
      type: "MOVE",
      clientX: 999,
      clientY: 999,
      viewport,
    });
    expect(next).toBe(editing);
  });
});

describe("panel resizing", () => {
  it("modifies the rectangle from the correct handle, preserving aspect ratio", () => {
    const layout = withLayout({ cube: { x: 0.2, y: 0.3, width: 0.4, height: 0.3 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_RESIZE",
      item: "cube",
      handle: "bottom-right",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Move the bottom-right corner from (0.6, 0.6) to (0.8, 0.8). The pointer's
    // raw delta (0.2, 0.2) from the anchored top-left corner (0.2, 0.3) would
    // ask for a 0.6 x 0.5 box, but panels are aspect-locked to the original
    // 0.4:0.3 (4:3) ratio: the y-axis demand (0.5 * 4/3 = 0.6667) exceeds the
    // x-axis demand (0.6), so width grows to 2/3 and height is derived as
    // (2/3) / (4/3) = 0.5, keeping the 4:3 ratio anchored at (0.2, 0.3).
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 200,
      clientY: 160,
      viewport,
    });

    expect(moved.layout.cube.x).toBeCloseTo(0.2);
    expect(moved.layout.cube.y).toBeCloseTo(0.3);
    expect(moved.layout.cube.width).toBeCloseTo(2 / 3);
    expect(moved.layout.cube.height).toBeCloseTo(0.5);
    expect(moved.layout.cube.width / moved.layout.cube.height).toBeCloseTo(0.4 / 0.3);
    // The opposite corner (top-left) never moves for this handle.
    expect(moved.layout.timer).toBe(editing.layout.timer);
  });

  it("resizes from the top-left handle by moving the opposite corner, preserving aspect ratio", () => {
    const layout = withLayout({ cube: { x: 0.2, y: 0.3, width: 0.4, height: 0.3 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_RESIZE",
      item: "cube",
      handle: "top-left",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Move the top-left corner from (0.2, 0.3) to (0.1, 0.2), anchored at the
    // fixed bottom-right corner (0.6, 0.6). Raw demand is 0.5 wide / 0.4 tall;
    // the x-axis demand (0.5) exceeds the y-axis demand scaled by the 4:3
    // ratio (0.4 * 4/3 = 0.5333), so width grows to 8/15 and height is
    // derived as (8/15) / (4/3) = 0.4, keeping the 4:3 ratio.
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: -100,
      clientY: -80,
      viewport,
    });

    expect(moved.layout.cube.x).toBeCloseTo(0.6 - 8 / 15);
    expect(moved.layout.cube.y).toBeCloseTo(0.2);
    expect(moved.layout.cube.width).toBeCloseTo(8 / 15);
    expect(moved.layout.cube.height).toBeCloseTo(0.4);
    expect(moved.layout.cube.width / moved.layout.cube.height).toBeCloseTo(0.4 / 0.3);
  });

  it("resizes the sidebar's width only, leaving its position/height untouched", () => {
    const layout = withLayout({ sidebar: { x: 0.1, y: 0.2, width: 0.3, height: 0.5 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_RESIZE",
      item: "sidebar",
      handle: "bottom-right",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Drag the bottom-right handle both right and down; only the rightward
    // (x-axis) component should have any effect, since the sidebar's height
    // is meant to stay intrinsic to its content, not a value the user drags.
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 100,
      clientY: 400,
      viewport,
    });

    expect(moved.layout.sidebar.x).toBeCloseTo(0.1);
    expect(moved.layout.sidebar.y).toBe(0.2);
    expect(moved.layout.sidebar.height).toBe(0.5);
    expect(moved.layout.sidebar.width).toBeCloseTo(0.4);
  });

  it("resizes leftZone/rightZone freely, without locking their aspect ratio", () => {
    const layout = withLayout({ leftZone: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_RESIZE",
      item: "leftZone",
      handle: "bottom-right",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Move the bottom-right corner from (0.4, 0.4) to (0.7, 0.5): a much
    // bigger horizontal move than vertical. A locked box would grow height to
    // match (0.3 wide would demand 0.3 tall to stay square); a free-form zone
    // must instead track each axis independently.
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 300,
      clientY: 80,
      viewport,
    });

    expect(moved.layout.leftZone).toEqual({ x: 0.1, y: 0.1, width: 0.6, height: 0.4 });
    expect(moved.layout.leftZone.width / moved.layout.leftZone.height).not.toBeCloseTo(1);
  });
});

describe("snapping", () => {
  it("snaps into place near a threshold", () => {
    const layout = withLayout({ cube: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_DRAG",
      item: "cube",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Move near the top-right target (x: 0.8, y: 0) — within the 100px threshold.
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 290,
      clientY: -384,
      viewport,
    });

    expect(moved.layout.cube).toMatchObject({ x: 0.8, y: 0 });
  });

  it("leaves free placement unsnapped outside the threshold", () => {
    const layout = withLayout({ cube: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_DRAG",
      item: "cube",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    // Move to (0.23, 0.31) — far from every snap candidate.
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: -270,
      clientY: -152,
      viewport,
    });

    expect(moved.layout.cube).toEqual({ x: 0.23, y: 0.31, width: 0.2, height: 0.2 });
  });
});

describe("END_INTERACTION", () => {
  it("marks the layout for persistence exactly once, not on every pointer move", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const started = editorReducer(editing, {
      type: "START_DRAG",
      item: "timer",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    const moved1 = editorReducer(started, { type: "MOVE", clientX: 10, clientY: 10, viewport });
    const moved2 = editorReducer(moved1, { type: "MOVE", clientX: 20, clientY: 20, viewport });
    expect(saveHudLayout).not.toHaveBeenCalled();

    const ended = editorReducer(moved2, { type: "END_INTERACTION" });
    expect(ended.interaction).toBeNull();
    expect(saveHudLayout).toHaveBeenCalledTimes(1);
    expect(saveHudLayout).toHaveBeenCalledWith(ended.layout);
  });

  it("is a no-op when there is no active interaction", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const next = editorReducer(editing, { type: "END_INTERACTION" });
    expect(next).toBe(editing);
    expect(saveHudLayout).not.toHaveBeenCalled();
  });
});

describe("SYNC_LAYOUT", () => {
  it("is a no-op (same reference) when the incoming layout matches by value", () => {
    // A caller that mirrors `state.layout` back in as a prop always passes a
    // fresh clone, even when nothing changed. If this ever created a new
    // `state.layout` reference, it would re-fire the caller's own effect,
    // which would SYNC_LAYOUT again — an infinite loop.
    const state = createEditorState(DEFAULT_HUD_LAYOUT);
    const echoedBack = { ...DEFAULT_HUD_LAYOUT, sidebar: { ...DEFAULT_HUD_LAYOUT.sidebar } };
    const next = editorReducer(state, { type: "SYNC_LAYOUT", layout: echoedBack });
    expect(next).toBe(state);
  });

  it("adopts a genuinely different incoming layout", () => {
    const state = createEditorState(DEFAULT_HUD_LAYOUT);
    const changed = withLayout({ timer: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 } });
    const next = editorReducer(state, { type: "SYNC_LAYOUT", layout: changed });
    expect(next.layout).toEqual(changed);
    expect(next).not.toBe(state);
  });

  it("ignores an incoming layout while an interaction is active, even if it differs", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    const dragging = editorReducer(editing, {
      type: "START_DRAG",
      item: "timer",
      clientX: 0,
      clientY: 0,
      viewport,
    });
    const changed = withLayout({ timer: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 } });
    const next = editorReducer(dragging, { type: "SYNC_LAYOUT", layout: changed });
    expect(next).toBe(dragging);
  });
});

describe("RESET", () => {
  it("replaces every configurable item with the defaults and clears storage", () => {
    const layout = withLayout({
      sidebar: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      timer: { x: 0.4, y: 0.1, width: 0.3, height: 0.2 },
      cube: { x: 0.75, y: 0.1, width: 0.2, height: 0.2 },
      leftZone: { x: 0.1, y: 0.6, width: 0.3, height: 0.3 },
      rightZone: { x: 0.55, y: 0.6, width: 0.3, height: 0.3 },
    });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });

    const reset = editorReducer(editing, { type: "RESET" });

    expect(reset.layout).toEqual(DEFAULT_HUD_LAYOUT);
    expect(reset.interaction).toBeNull();
    expect(clearHudLayout).toHaveBeenCalledTimes(1);
  });
});

describe("selectShowReset", () => {
  it("is false for the default layout even while editing", () => {
    const editing = editorReducer(createEditorState(DEFAULT_HUD_LAYOUT), { type: "TOGGLE_EDIT" });
    expect(selectShowReset(editing)).toBe(false);
  });

  it("is false while not editing, regardless of the layout", () => {
    const state = createEditorState(withLayout({ timer: { x: 0.31, y: 0.03, width: 0.4, height: 0.24 } }));
    expect(selectShowReset(state)).toBe(false);
  });

  it("is true once the layout diverges from defaults while editing", () => {
    const layout = withLayout({ timer: { x: 0.31, y: 0.03, width: 0.4, height: 0.24 } });
    const editing = editorReducer(createEditorState(layout), { type: "TOGGLE_EDIT" });
    expect(selectShowReset(editing)).toBe(true);
  });
});
