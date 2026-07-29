import type { HudLayout } from "./types";

// These positions preserve the non-running HUD: panels flush against the
// top/left/right screen edges, timer centered at top, and hand pads across
// the lower left and right of the camera feed.
export const DEFAULT_HUD_LAYOUT: HudLayout = {
  sidebar: { x: 0, y: 0, width: 0.27, height: 0.55 },
  timer: { x: 0.3, y: 0, width: 0.4, height: 0.24 },
  cube: { x: 0.81, y: 0, width: 0.19, height: 0.28 },
  leftZone: { x: 0.05, y: 0.7, width: 0.35, height: 0.3 },
  rightZone: { x: 0.6, y: 0.7, width: 0.35, height: 0.3 },
};
