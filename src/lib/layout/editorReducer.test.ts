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
  it("modifies the rectangle from the correct handle", () => {
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
    // Move the bottom-right corner from (0.6, 0.6) to (0.8, 0.8).
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: 200,
      clientY: 160,
      viewport,
    });

    expect(moved.layout.cube).toEqual({ x: 0.2, y: 0.3, width: 0.6, height: 0.5 });
    // The opposite corner (top-left) never moves for this handle.
    expect(moved.layout.timer).toBe(editing.layout.timer);
  });

  it("resizes from the top-left handle by moving the opposite corner", () => {
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
    // Move the top-left corner from (0.2, 0.3) to (0.1, 0.2).
    const moved = editorReducer(started, {
      type: "MOVE",
      clientX: -100,
      clientY: -80,
      viewport,
    });

    expect(moved.layout.cube).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 });
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
