import type { TimerPhase } from "@/lib/timer/store";

/**
 * Layout editing (drag/resize/reset) is only allowed while the timer is not
 * actively running a solve. This keeps `RUNNING`'s focus-mode presentation
 * untouched and prevents accidental layout changes mid-solve.
 */
export function canEditLayout(phase: TimerPhase): boolean {
  return phase !== "RUNNING";
}
