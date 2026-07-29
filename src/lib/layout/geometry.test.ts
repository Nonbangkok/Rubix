import { describe, expect, it } from "vitest";
import {
  cameraRectToScreenRect,
  clampRect,
  layoutEquals,
  mirrorHandleX,
  mirrorRectX,
  resizeRect,
  resizeRectLocked,
  resizeRectWidthOnly,
  screenPointToCameraPoint,
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

describe("resizeRectLocked", () => {
  const rect = { x: 0.2, y: 0.3, width: 0.4, height: 0.3 }; // aspect = 4/3
  const aspect = rect.width / rect.height;

  it("preserves aspect ratio when dragging directly along the diagonal", () => {
    // Anchor (top-left, opposite bottom-right) is (0.2, 0.3). Scaling the box
    // by 1.5x along the diagonal should land exactly on the scaled rect.
    const point = { x: 0.2 + rect.width * 1.5, y: 0.3 + rect.height * 1.5 };
    expect(resizeRectLocked(rect, "bottom-right", point)).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.6,
      height: 0.45,
    });
  });

  it("scales the other dimension to preserve aspect ratio for a mostly one-axis drag", () => {
    // Pointer moves far in x (anchor.x + 0.7) but barely in y (anchor.y + 0.02).
    // A distorted resize would produce height ~= 0.02; the locked resize must
    // instead derive height from the original 4:3 ratio.
    const point = { x: 0.2 + 0.7, y: 0.3 + 0.02 };
    const result = resizeRectLocked(rect, "bottom-right", point);
    expect(result.width).toBeCloseTo(0.7);
    expect(result.height).toBeCloseTo(0.7 / aspect);
    expect(result.width / result.height).toBeCloseTo(aspect);
  });

  it("preserves aspect ratio even when the minimum-size floor binds", () => {
    // Pointer barely moves off the anchor, well under both minimums. Height's
    // floor (0.1) demands a wider box (0.1 * 4/3 = 0.1333) than width's own
    // floor (0.1), so that binds and both dimensions are derived from it.
    const point = { x: 0.2 + 0.05, y: 0.3 + 0.02 };
    const result = resizeRectLocked(rect, "bottom-right", point, 0.1, 0.1);
    expect(result.height).toBeCloseTo(0.1);
    expect(result.width).toBeCloseTo(0.1 * aspect);
    expect(result.width / result.height).toBeCloseTo(aspect);
  });

  it.each([
    // Points chosen so the resulting box stays within the unit square (no
    // clamping), which would otherwise disturb the anchor and confound this
    // assertion — clamp-induced distortion at the viewport edge is a
    // separate, acceptable edge case (see resizeRectLocked's doc comment).
    ["top-left", { x: 0.1, y: 0.2 }],
    ["top-right", { x: 0.8, y: 0.2 }],
    ["bottom-left", { x: 0.3, y: 0.7 }],
    ["bottom-right", { x: 0.7, y: 0.8 }],
  ] as const)("anchors the opposite corner in place for the %s handle", (handle, point) => {
    const result = resizeRectLocked(rect, handle, point);
    switch (handle) {
      case "top-left":
        expect(result.x + result.width).toBeCloseTo(rect.x + rect.width);
        expect(result.y + result.height).toBeCloseTo(rect.y + rect.height);
        break;
      case "top-right":
        expect(result.x).toBeCloseTo(rect.x);
        expect(result.y + result.height).toBeCloseTo(rect.y + rect.height);
        break;
      case "bottom-left":
        expect(result.x + result.width).toBeCloseTo(rect.x + rect.width);
        expect(result.y).toBeCloseTo(rect.y);
        break;
      case "bottom-right":
        expect(result.x).toBeCloseTo(rect.x);
        expect(result.y).toBeCloseTo(rect.y);
        break;
    }
    expect(result.width / result.height).toBeCloseTo(aspect);
  });
});

describe("resizeRectWidthOnly", () => {
  const rect = { x: 0.2, y: 0.3, width: 0.4, height: 0.3 };

  it.each([
    ["top-left", { x: 0.1, y: 0.9 }],
    ["bottom-left", { x: 0.1, y: -0.5 }],
  ] as const)("extends the left edge for the %s handle, ignoring the y component", (handle, point) => {
    const result = resizeRectWidthOnly(rect, handle, point);
    expect(result).toEqual({ x: 0.1, y: rect.y, width: 0.5, height: rect.height });
  });

  it.each([
    ["top-right", { x: 0.7, y: 0.9 }],
    ["bottom-right", { x: 0.7, y: -0.5 }],
  ] as const)("extends the right edge for the %s handle, ignoring the y component", (handle, point) => {
    const result = resizeRectWidthOnly(rect, handle, point);
    expect(result).toEqual({ x: rect.x, y: rect.y, width: 0.5, height: rect.height });
  });

  it("never changes y or height", () => {
    const result = resizeRectWidthOnly(rect, "bottom-right", { x: 0.9, y: 0.05 });
    expect(result.y).toBe(rect.y);
    expect(result.height).toBe(rect.height);
  });

  it("enforces the minimum width floor", () => {
    const result = resizeRectWidthOnly(rect, "top-right", { x: 0.21, y: 0.5 }, 0.15);
    expect(result.width).toBeCloseTo(0.15);
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

describe("mirrorRectX", () => {
  it.each([
    { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    { x: 0, y: 0.5, width: 0.2, height: 0.1 },
    { x: 0.6, y: 0.7, width: 0.35, height: 0.3 },
  ])("is self-inverse for %o", (rect) => {
    const roundTripped = mirrorRectX(mirrorRectX(rect));
    expect(roundTripped.x).toBeCloseTo(rect.x);
    expect(roundTripped.y).toBeCloseTo(rect.y);
    expect(roundTripped.width).toBeCloseTo(rect.width);
    expect(roundTripped.height).toBeCloseTo(rect.height);
  });

  it("maps the default leftZone rect to the default rightZone position", () => {
    // Sanity check: the two default zones are symmetric across the vertical
    // midline, so mirroring one should exactly reproduce the other's numbers.
    expect(mirrorRectX(DEFAULT_HUD_LAYOUT.leftZone)).toEqual({
      x: 0.6,
      y: 0.7,
      width: 0.35,
      height: 0.3,
    });
  });
});

describe("mirrorHandleX", () => {
  it("swaps left and right corner handles, leaving the vertical axis alone", () => {
    expect(mirrorHandleX("top-left")).toBe("top-right");
    expect(mirrorHandleX("top-right")).toBe("top-left");
    expect(mirrorHandleX("bottom-left")).toBe("bottom-right");
    expect(mirrorHandleX("bottom-right")).toBe("bottom-left");
  });

  it("is self-inverse", () => {
    const handles = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
    for (const handle of handles) {
      expect(mirrorHandleX(mirrorHandleX(handle))).toBe(handle);
    }
  });
});

describe("cameraRectToScreenRect", () => {
  it("reduces to mirrorRectX when the camera's aspect ratio matches the viewport's (no crop)", () => {
    const rect = { x: 0.05, y: 0.7, width: 0.35, height: 0.3 };
    const cam = { videoWidth: 1280, videoHeight: 720, viewportWidth: 1280, viewportHeight: 720 };
    const result = cameraRectToScreenRect(rect, cam);
    const expected = mirrorRectX(rect);
    expect(result.x).toBeCloseTo(expected.x);
    expect(result.y).toBeCloseTo(expected.y);
    expect(result.width).toBeCloseTo(expected.width);
    expect(result.height).toBeCloseTo(expected.height);
  });

  it("accounts for object-cover cropping when the viewport is a different aspect ratio", () => {
    // 1280x720 (16:9) video into an 800x800 (1:1) viewport: object-cover scales
    // by max(800/1280, 800/720) = 10/9, filling height exactly and cropping the
    // sides — so a rect centered on the camera frame stays centered on screen,
    // but a width-only rect's fraction grows (the cropped axis is "zoomed in"
    // relative to the viewport), while a rect on the uncropped (height) axis
    // keeps its fraction unchanged.
    const cam = { videoWidth: 1280, videoHeight: 720, viewportWidth: 800, viewportHeight: 800 };
    const rect = { x: 0.45, y: 0.45, width: 0.1, height: 0.1 };
    const result = cameraRectToScreenRect(rect, cam);

    expect(result.y).toBeCloseTo(0.45); // height axis: unchanged, no crop
    expect(result.height).toBeCloseTo(0.1);
    expect(result.x + result.width / 2).toBeCloseTo(0.5); // still centered on screen
    expect(result.width).toBeGreaterThan(rect.width); // cropped axis reads "zoomed in"
  });
});

describe("screenPointToCameraPoint", () => {
  const cam = { videoWidth: 1280, videoHeight: 720, viewportWidth: 800, viewportHeight: 800 };

  it("round-trips with cameraRectToScreenRect for a point", () => {
    const cameraPoint = { x: 0.3, y: 0.6 };
    const rect = { ...cameraPoint, width: 0, height: 0 };
    const screenRect = cameraRectToScreenRect(rect, cam);
    const roundTripped = screenPointToCameraPoint({ x: screenRect.x, y: screenRect.y }, cam);
    expect(roundTripped.x).toBeCloseTo(cameraPoint.x);
    expect(roundTripped.y).toBeCloseTo(cameraPoint.y);
  });

  it("maps the screen center to the camera-frame center", () => {
    const result = screenPointToCameraPoint({ x: 0.5, y: 0.5 }, cam);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });
});
