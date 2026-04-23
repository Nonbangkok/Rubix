"use client";

import { useTimerStore } from "@/lib/timer/store";
import { ao5, ao12, formatMs, pb } from "@/lib/timer/stats";
import styles from "./Stats.module.css";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

export function Stats() {
  const solves = useTimerStore((s) => s.solves);
  const clearHistory = useTimerStore((s) => s.clearHistory);

  return (
    <div className={styles.pill}>
      <Stat label="PB" value={formatMs(pb(solves))} />
      <span className={styles.sep} />
      <Stat label="Ao5" value={formatMs(ao5(solves))} />
      <span className={styles.sep} />
      <Stat label="Ao12" value={formatMs(ao12(solves))} />
      <span className={styles.sep} />
      <Stat label="solves" value={solves.length.toString()} />
    </div>
  );
}
