"use client";

import type { ReactNode } from "react";
import { useTimerStore } from "@/lib/timer/store";
import styles from "./TimerScreen.module.css";

export function TimerScreen({ children }: { children: ReactNode }) {
  const phase = useTimerStore((s) => s.phase);
  return (
    <div className={`${styles.screen} ${styles[phase.toLowerCase()]}`}>
      {children}
    </div>
  );
}
