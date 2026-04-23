"use client";

import { useTimerStore } from "@/lib/timer/store";
import styles from "./History.module.css";

function formatHistoryTime(ms: number): string {
  const totalSec = ms / 1000;
  const whole = Math.floor(totalSec);
  const frac = Math.floor(ms - whole * 1000)
    .toString()
    .padStart(3, "0");
  
  if (whole >= 60) {
    const m = Math.floor(whole / 60);
    const s = (whole % 60).toString().padStart(2, "0");
    return `${m}:${s}.${frac}`;
  }
  return `${whole}.${frac}`;
}

export function History() {
  const solves = useTimerStore((s) => s.solves);
  const deleteSolve = useTimerStore((s) => s.deleteSolve);
  
  // Show only last 8 solves
  const displaySolves = [...solves].reverse().slice(0, 8);

  return (
    <div className={styles.container}>
      {displaySolves.length === 0 ? (
        <div className={styles.empty}>no history</div>
      ) : (
        displaySolves.map((ms, i) => {
          const originalIndex = solves.length - 1 - i;
          return (
            <div key={originalIndex} className={styles.item}>
              <div className={styles.left}>
                <span className={styles.index}>#{originalIndex + 1}</span>
                <span className={styles.value}>{formatHistoryTime(ms)}</span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => deleteSolve(originalIndex)}
                aria-label="Delete solve"
              >
                ×
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
