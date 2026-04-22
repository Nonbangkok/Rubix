"use client";

import { useTimerStore } from "@/lib/timer/store";
import { useHighPrecisionTimer } from "@/lib/timer/useHighPrecisionTimer";
import styles from "./Digits.module.css";

function splitDisplay(ms: number): { big: string; small: string } {
  const safe = Math.max(0, ms);
  const totalSec = safe / 1000;
  const whole = Math.floor(totalSec);
  const frac = Math.max(0, Math.floor(safe - whole * 1000))
    .toString()
    .padStart(3, "0");
  if (whole >= 60) {
    const m = Math.floor(whole / 60);
    const s = (whole % 60).toString().padStart(2, "0");
    return { big: `${m}:${s}`, small: `.${frac}` };
  }
  return { big: whole.toString().padStart(2, "0"), small: `.${frac}` };
}

export function Digits() {
  const phase = useTimerStore((s) => s.phase);
  const runStartedAt = useTimerStore((s) => s.runStartedAt);
  const runFinishedAt = useTimerStore((s) => s.runFinishedAt);

  const active = phase === "RUNNING";
  const liveElapsed = useHighPrecisionTimer(active, runStartedAt);
  const staticElapsed =
    phase === "FINISHED" && runStartedAt !== null && runFinishedAt !== null
      ? runFinishedAt - runStartedAt
      : 0;
  const ms = active ? liveElapsed : staticElapsed;
  const { big, small } = splitDisplay(ms);

  return (
    <div
      className={`${styles.digits} ${styles[phase.toLowerCase()]}`}
      aria-live="off"
    >
      <span className={styles.big}>{big}</span>
      <span className={styles.small}>{small}</span>
    </div>
  );
}
