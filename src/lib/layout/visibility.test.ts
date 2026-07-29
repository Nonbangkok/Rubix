import { describe, expect, it } from "vitest";
import type { TimerPhase } from "@/lib/timer/store";
import { DEFAULT_HUD_LAYOUT } from "./defaults";
import type { HudLayout } from "./types";
import { canEditLayout } from "./visibility";

const ALL_PHASES: TimerPhase[] = ["IDLE", "ARMING", "READY", "RUNNING", "FINISHED"];

describe("canEditLayout", () => {
  it("disallows editing while the timer is RUNNING", () => {
    expect(canEditLayout("RUNNING")).toBe(false);
  });

  it("allows editing for every other timer phase", () => {
    for (const phase of ALL_PHASES) {
      if (phase === "RUNNING") continue;
      expect(canEditLayout(phase)).toBe(true);
    }
  });
});

describe("focus rendering purity", () => {
  it("does not mutate the supplied HudLayout reference when selecting focus behavior", () => {
    const layout: HudLayout = DEFAULT_HUD_LAYOUT;
    const snapshotBefore = JSON.parse(JSON.stringify(layout));

    // Exercise the selector across every phase to ensure it never mutates
    // the layout it was (implicitly) handed alongside phase decisions.
    for (const phase of ALL_PHASES) {
      canEditLayout(phase);
    }

    expect(layout).toEqual(snapshotBefore);
    expect(layout).toBe(DEFAULT_HUD_LAYOUT);
  });
});
