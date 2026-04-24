"use client";

import { useEffect } from "react";
import type { VisionState } from "@/lib/vision/useHandVision";
import { useTimerStore } from "./store";

// Wires vision + keyboard inputs into the timer store, and fires sound cues
// on state transitions.
export function useTimerDriver(vision: VisionState): void {
  const handlePad = useTimerStore((s) => s.handlePad);
  const phase = useTimerStore((s) => s.phase);

  // Vision → store
  // Use raw zones for instant stop when running, smoothed for stable arming
  const currentZones = phase === "RUNNING" ? vision.rawZones : vision.smoothedZones;
  const left = currentZones.left;
  const right = currentZones.right;

  useEffect(() => {
    handlePad(left, right, performance.now());
  }, [left, right, handlePad]);

  // Spacebar → store (treated as both-hands-on while held)
  useEffect(() => {
    let held = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      held = true;
      handlePad(true, true, performance.now());
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !held) return;
      e.preventDefault();
      held = false;
      handlePad(false, false, performance.now());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [handlePad]);

  // Sound cues on phase transitions
  // (Removed ready/stop sounds as requested)
}
