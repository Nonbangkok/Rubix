"use client";

import { useEffect, useRef } from "react";
import type { VisionState } from "@/lib/vision/useHandVision";
import { useTimerStore } from "./store";

const READY_SOUND = "/sounds/ready.mp3";
const STOP_SOUND = "/sounds/stop.mp3";

function playSilent(src: string): void {
  try {
    const a = new Audio(src);
    a.volume = 0.7;
    // Suppress unhandled-rejection noise if file is missing or autoplay blocked.
    void a.play().catch(() => undefined);
  } catch {
    // noop
  }
}

// Wires vision + keyboard inputs into the timer store, and fires sound cues
// on state transitions.
export function useTimerDriver(vision: VisionState): void {
  const handlePad = useTimerStore((s) => s.handlePad);
  const phase = useTimerStore((s) => s.phase);

  // Vision → store
  const leftSmoothed = vision.smoothedZones.left;
  const rightSmoothed = vision.smoothedZones.right;
  useEffect(() => {
    handlePad(leftSmoothed, rightSmoothed, performance.now());
  }, [leftSmoothed, rightSmoothed, handlePad]);

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
  const prevPhase = useRef(phase);
  useEffect(() => {
    const from = prevPhase.current;
    prevPhase.current = phase;
    if (from === phase) return;
    if (phase === "READY") playSilent(READY_SOUND);
    if (phase === "FINISHED" && from === "RUNNING") playSilent(STOP_SOUND);
  }, [phase]);
}
