import type {
  HudLayout,
  LayoutItemId,
  LayoutRect,
  NormalizedPoint,
  ResizeHandle,
  ViewportSize,
  ZoneRect,
} from "./types";

export const MIN_PANEL_SIZE = 0.08;
export const MIN_ZONE_SIZE = 0.1;

const SNAP_THRESHOLD_PX = 100;

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function bounded(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rounded(value: number) {
  return Number(value.toFixed(12));
}

function roundedRect(rect: LayoutRect): LayoutRect {
  return {
    x: rounded(rect.x),
    y: rounded(rect.y),
    width: rounded(rect.width),
    height: rounded(rect.height),
  };
}

function minimumSize(value: number | undefined) {
  return bounded(finiteOr(value ?? MIN_PANEL_SIZE, MIN_PANEL_SIZE), 0, 1);
}

/** Gives callers the correct resize floor for a configurable item. */
export function minimumSizeForItem(item: LayoutItemId): number {
  return item === "leftZone" || item === "rightZone" ? MIN_ZONE_SIZE : MIN_PANEL_SIZE;
}

/** Returns a rectangle that fits within the normalized viewport. */
export function clampRect(
  rect: LayoutRect,
  minWidth = MIN_PANEL_SIZE,
  minHeight = MIN_PANEL_SIZE,
): LayoutRect {
  const width = bounded(finiteOr(rect.width, minWidth), minimumSize(minWidth), 1);
  const height = bounded(finiteOr(rect.height, minHeight), minimumSize(minHeight), 1);

  return roundedRect({
    x: bounded(finiteOr(rect.x, 0), 0, 1 - width),
    y: bounded(finiteOr(rect.y, 0), 0, 1 - height),
    width,
    height,
  });
}

/** Resizes one corner while keeping the diagonally opposite corner fixed. */
export function resizeRect(
  rect: LayoutRect,
  handle: ResizeHandle,
  point: NormalizedPoint,
  minWidth = MIN_PANEL_SIZE,
  minHeight = minWidth,
): LayoutRect {
  const current = clampRect(rect, minWidth, minHeight);
  const widthFloor = minimumSize(minWidth);
  const heightFloor = minimumSize(minHeight);
  const right = current.x + current.width;
  const bottom = current.y + current.height;
  const pointX = finiteOr(point.x, current.x);
  const pointY = finiteOr(point.y, current.y);

  switch (handle) {
    case "top-left": {
      const x = bounded(pointX, 0, right - widthFloor);
      const y = bounded(pointY, 0, bottom - heightFloor);
      return roundedRect({ x, y, width: right - x, height: bottom - y });
    }
    case "top-right": {
      const nextRight = bounded(pointX, current.x + widthFloor, 1);
      const y = bounded(pointY, 0, bottom - heightFloor);
      return roundedRect({ x: current.x, y, width: nextRight - current.x, height: bottom - y });
    }
    case "bottom-left": {
      const x = bounded(pointX, 0, right - widthFloor);
      const nextBottom = bounded(pointY, current.y + heightFloor, 1);
      return roundedRect({ x, y: current.y, width: right - x, height: nextBottom - current.y });
    }
    case "bottom-right": {
      const nextRight = bounded(pointX, current.x + widthFloor, 1);
      const nextBottom = bounded(pointY, current.y + heightFloor, 1);
      return roundedRect({
        x: current.x,
        y: current.y,
        width: nextRight - current.x,
        height: nextBottom - current.y,
      });
    }
  }
}

/** Snaps a rectangle near a corner or edge centre, preserving its dimensions. */
export function snapRect(rect: LayoutRect, viewport: ViewportSize): LayoutRect {
  const current = clampRect(rect);
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return current;
  }

  const centerX = (1 - current.width) / 2;
  const centerY = (1 - current.height) / 2;
  const right = 1 - current.width;
  const bottom = 1 - current.height;
  const candidates = [
    { x: 0, y: 0 },
    { x: centerX, y: 0 },
    { x: right, y: 0 },
    { x: 0, y: centerY },
    { x: right, y: centerY },
    { x: 0, y: bottom },
    { x: centerX, y: bottom },
    { x: right, y: bottom },
  ];

  const nearest = candidates.reduce<{ x: number; y: number; distance: number } | undefined>(
    (closest, candidate) => {
      const distance = Math.hypot(
        (current.x - candidate.x) * viewport.width,
        (current.y - candidate.y) * viewport.height,
      );
      return !closest || distance < closest.distance ? { ...candidate, distance } : closest;
    },
    undefined,
  );

  return nearest && nearest.distance <= SNAP_THRESHOLD_PX
    ? roundedRect({ ...current, x: nearest.x, y: nearest.y })
    : current;
}

export function zoneRectFromLayout(rect: LayoutRect): ZoneRect {
  return {
    x0: rect.x,
    y0: rect.y,
    x1: rect.x + rect.width,
    y1: rect.y + rect.height,
  };
}

export function layoutEquals(left: HudLayout, right: HudLayout): boolean {
  return (
    left.sidebar.x === right.sidebar.x &&
    left.sidebar.y === right.sidebar.y &&
    left.sidebar.width === right.sidebar.width &&
    left.sidebar.height === right.sidebar.height &&
    left.timer.x === right.timer.x &&
    left.timer.y === right.timer.y &&
    left.timer.width === right.timer.width &&
    left.timer.height === right.timer.height &&
    left.cube.x === right.cube.x &&
    left.cube.y === right.cube.y &&
    left.cube.width === right.cube.width &&
    left.cube.height === right.cube.height &&
    left.leftZone.x === right.leftZone.x &&
    left.leftZone.y === right.leftZone.y &&
    left.leftZone.width === right.leftZone.width &&
    left.leftZone.height === right.leftZone.height &&
    left.rightZone.x === right.rightZone.x &&
    left.rightZone.y === right.rightZone.y &&
    left.rightZone.width === right.rightZone.width &&
    left.rightZone.height === right.rightZone.height
  );
}
