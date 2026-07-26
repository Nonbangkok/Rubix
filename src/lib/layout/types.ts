export type LayoutItemId = "sidebar" | "timer" | "cube" | "leftZone" | "rightZone";

export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HudLayout = Record<LayoutItemId, LayoutRect>;

export type NormalizedPoint = Pick<LayoutRect, "x" | "y">;

export type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type ViewportSize = {
  width: number;
  height: number;
};

export type ZoneRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export const LAYOUT_ITEM_IDS = ["sidebar", "timer", "cube", "leftZone", "rightZone"] as const;
