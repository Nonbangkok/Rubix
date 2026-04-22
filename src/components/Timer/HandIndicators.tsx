"use client";

import { useTimerStore, type TimerPhase } from "@/lib/timer/store";
import type { PadZoneState } from "@/lib/vision/types";
import styles from "./HandIndicators.module.css";

type Variant = "off" | "neutral" | "red" | "green" | "white" | "yellow";

function variantFor(onPad: boolean, phase: TimerPhase): Variant {
  if (!onPad) return "off";
  switch (phase) {
    case "ARMING":
      return "red";
    case "READY":
      return "green";
    case "RUNNING":
      return "white";
    case "FINISHED":
      return "yellow";
    case "IDLE":
    default:
      return "neutral";
  }
}

export function HandIndicators({ zones }: { zones: PadZoneState }) {
  const phase = useTimerStore((s) => s.phase);
  const left = variantFor(zones.left, phase);
  const right = variantFor(zones.right, phase);

  return (
    <div className={styles.row} role="status" aria-label={`phase ${phase}`}>
      <span className={styles.label}>L</span>
      <div
        className={`${styles.light} ${left !== "off" ? styles[left] : ""}`}
      />
      <div
        className={`${styles.light} ${right !== "off" ? styles[right] : ""}`}
      />
      <span className={styles.label}>R</span>
    </div>
  );
}
