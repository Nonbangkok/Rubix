import { DEFAULT_HUD_LAYOUT } from "./defaults";
import { LAYOUT_ITEM_IDS, type HudLayout, type LayoutRect } from "./types";

export const LAYOUT_STORAGE_KEY = "rubix.hud-layout";
export const LAYOUT_STORAGE_VERSION = 1;

type StoredHudLayout = {
  version: number;
  layout: HudLayout;
};

function copyLayout(layout: HudLayout): HudLayout {
  return {
    sidebar: { ...layout.sidebar },
    timer: { ...layout.timer },
    cube: { ...layout.cube },
    leftZone: { ...layout.leftZone },
    rightZone: { ...layout.rightZone },
  };
}

function isLayoutRect(value: unknown): value is LayoutRect {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const rect = value as Record<string, unknown>;
  const numbers = [rect.x, rect.y, rect.width, rect.height];
  return (
    numbers.every((number) => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1) &&
    (rect.x as number) + (rect.width as number) <= 1 &&
    (rect.y as number) + (rect.height as number) <= 1
  );
}

function isStoredHudLayout(value: unknown): value is StoredHudLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.version !== LAYOUT_STORAGE_VERSION || !record.layout || typeof record.layout !== "object") {
    return false;
  }

  const layout = record.layout as Record<string, unknown>;
  return LAYOUT_ITEM_IDS.every((id) => isLayoutRect(layout[id]));
}

function defaults() {
  return copyLayout(DEFAULT_HUD_LAYOUT);
}

export function loadHudLayout(): HudLayout {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return defaults();
    }

    const stored = globalThis.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) {
      return defaults();
    }

    const parsed: unknown = JSON.parse(stored);
    return isStoredHudLayout(parsed) ? copyLayout(parsed.layout) : defaults();
  } catch {
    return defaults();
  }
}

export function saveHudLayout(layout: HudLayout): void {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({ version: LAYOUT_STORAGE_VERSION, layout }),
      );
    }
  } catch {
    // Storage can be unavailable or disabled, so persistence remains optional.
  }
}

export function clearHudLayout(): void {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable or disabled, so persistence remains optional.
  }
}
