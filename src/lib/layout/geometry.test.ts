import { describe, expect, it } from "vitest";
import {
  clampRect,
  layoutEquals,
  resizeRect,
  snapRect,
  zoneRectFromLayout,
} from "./geometry";
import { DEFAULT_HUD_LAYOUT } from "./defaults";

describe("clampRect", () => {
  it("keeps a rectangle inside the normalized viewport", () => {
    expect(clampRect({ x: -0.2, y: 0.9, width: 0.5, height: 0.4 })).toEqual({
      x: 0,
      y: 0.6,
      width: 0.5,
      height: 0.4,
    });
  });

  it("enforces minimum dimensions without exceeding the viewport", () => {
    expect(
      clampRect({ x: 0.9, y: 0.9, width: 0.01, height: 0.02 }, 0.2, 0.3),
    ).toEqual({ x: 0.8, y: 0.7, width: 0.2, height: 0.3 });
  });

  it("clamps a rectangle that extends past the right and bottom edges", () => {
    expect(clampRect({ x: 0.8, y: 0.8, width: 0.4, height: 0.5 })).toEqual({
      x: 0.6,
      y: 0.5,
      width: 0.4,
      height: 0.5,
    });
  });
});

describe("resizeRect", () => {
  const rect = { x: 0.2, y: 0.3, width: 0.4, height: 0.3 };

  it.each([
    ["top-left", { x: 0.1, y: 0.2 }, { x: 0.1, y: 0.2, width: 0.5, height: 0.4 }],
    ["top-right", { x: 0.8, y: 0.2 }, { x: 0.2, y: 0.2, width: 0.6, height: 0.4 }],
    ["bottom-left", { x: 0.1, y: 0.8 }, { x: 0.1, y: 0.3, width: 0.5, height: 0.5 }],
    ["bottom-right", { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.3, width: 0.6, height: 0.5 }],
  ] as const)("resizes from the %s handle", (handle, point, expected) => {
    expect(resizeRect(rect, handle, point)).toEqual(expected);
  });
});

describe("snapRect", () => {
  const viewport = { width: 1000, height: 800 };

  it("leaves free placement outside snap thresholds unchanged", () => {
    const rect = { x: 0.23, y: 0.31, width: 0.2, height: 0.2 };
    expect(snapRect(rect, viewport)).toEqual(rect);
  });

  it.each([
    ["top-left", { x: 0.01, y: 0.01, width: 0.2, height: 0.2 }, { x: 0, y: 0 }],
    ["top-center", { x: 0.49, y: 0.01, width: 0.2, height: 0.2 }, { x: 0.4, y: 0 }],
    ["top-right", { x: 0.79, y: 0.01, width: 0.2, height: 0.2 }, { x: 0.8, y: 0 }],
    ["center-left", { x: 0.01, y: 0.39, width: 0.2, height: 0.2 }, { x: 0, y: 0.4 }],
    ["center-right", { x: 0.79, y: 0.39, width: 0.2, height: 0.2 }, { x: 0.8, y: 0.4 }],
    ["bottom-left", { x: 0.01, y: 0.79, width: 0.2, height: 0.2 }, { x: 0, y: 0.8 }],
    ["bottom-center", { x: 0.39, y: 0.79, width: 0.2, height: 0.2 }, { x: 0.4, y: 0.8 }],
    ["bottom-right", { x: 0.79, y: 0.79, width: 0.2, height: 0.2 }, { x: 0.8, y: 0.8 }],
  ] as const)("snaps to %s", (_name, rect, expected) => {
    expect(snapRect(rect, viewport)).toMatchObject(expected);
  });
});

describe("layout helpers", () => {
  it("compares every configurable layout item", () => {
    expect(layoutEquals(DEFAULT_HUD_LAYOUT, { ...DEFAULT_HUD_LAYOUT })).toBe(true);
    expect(
      layoutEquals(DEFAULT_HUD_LAYOUT, {
        ...DEFAULT_HUD_LAYOUT,
        timer: { ...DEFAULT_HUD_LAYOUT.timer, x: 0.31 },
      }),
    ).toBe(false);
  });

  it("converts a layout rectangle to a zone rectangle", () => {
    const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    expect(zoneRectFromLayout(rect)).toEqual({
      x0: rect.x,
      y0: rect.y,
      x1: rect.x + rect.width,
      y1: rect.y + rect.height,
    });
  });
});
