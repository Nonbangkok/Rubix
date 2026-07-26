import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HUD_LAYOUT } from "./defaults";
import { LAYOUT_STORAGE_KEY, LAYOUT_STORAGE_VERSION, clearHudLayout, loadHudLayout, saveHudLayout } from "./storage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HUD layout storage", () => {
  it("returns defaults when no record is stored", () => {
    expect(loadHudLayout()).toEqual(DEFAULT_HUD_LAYOUT);
  });

  it("returns defaults when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(loadHudLayout()).toEqual(DEFAULT_HUD_LAYOUT);
  });

  it("returns defaults when reading localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled");
      },
    });

    expect(loadHudLayout()).toEqual(DEFAULT_HUD_LAYOUT);
  });

  it("round-trips the entire layout", () => {
    const layout = {
      ...DEFAULT_HUD_LAYOUT,
      timer: { x: 0.25, y: 0.1, width: 0.5, height: 0.2 },
    };

    saveHudLayout(layout);

    expect(loadHudLayout()).toEqual(layout);
  });

  it.each([
    ["malformed JSON", "{"],
    ["wrong version", JSON.stringify({ version: LAYOUT_STORAGE_VERSION + 1, layout: DEFAULT_HUD_LAYOUT })],
    ["wrong schema", JSON.stringify({ version: LAYOUT_STORAGE_VERSION, layout: { timer: DEFAULT_HUD_LAYOUT.timer } })],
    [
      "non-finite value",
      `{"version":${LAYOUT_STORAGE_VERSION},"layout":{"sidebar":${JSON.stringify(DEFAULT_HUD_LAYOUT.sidebar)},"timer":${JSON.stringify(DEFAULT_HUD_LAYOUT.timer)},"cube":{"x":1e999,"y":0.03,"width":0.19,"height":0.28},"leftZone":${JSON.stringify(DEFAULT_HUD_LAYOUT.leftZone)},"rightZone":${JSON.stringify(DEFAULT_HUD_LAYOUT.rightZone)}}}`,
    ],
    [
      "out-of-bounds rectangle",
      JSON.stringify({
        version: LAYOUT_STORAGE_VERSION,
        layout: { ...DEFAULT_HUD_LAYOUT, cube: { ...DEFAULT_HUD_LAYOUT.cube, x: 1.1 } },
      }),
    ],
  ])("returns defaults for %s", (_name, stored) => {
    storage.setItem(LAYOUT_STORAGE_KEY, stored);
    expect(loadHudLayout()).toEqual(DEFAULT_HUD_LAYOUT);
  });

  it("clears the stored layout", () => {
    saveHudLayout(DEFAULT_HUD_LAYOUT);
    clearHudLayout();
    expect(loadHudLayout()).toEqual(DEFAULT_HUD_LAYOUT);
    expect(storage.getItem(LAYOUT_STORAGE_KEY)).toBeNull();
  });
});
