"use client";

import { useEffect, useState } from "react";
import { useTimerStore } from "@/lib/timer/store";
import { soundManager } from "@/lib/audio/sounds";
import styles from "./ScrambleStrip.module.css";

export function ScrambleStrip() {
  const [mounted, setMounted] = useState(false);
  const scramble = useTimerStore((s) => s.scramble);
  const regenerateAction = useTimerStore((s) => s.regenerateScramble);

  const regenerate = () => {
    regenerateAction();
    soundManager.play("ui");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={styles.strip}>
        <span className={styles.label}>SCRAMBLE</span>
        <span className={styles.moves}>...</span>
      </div>
    );
  }

  return (
    <div className={styles.strip}>
      <span className={styles.label}>SCRAMBLE</span>
      <span className={styles.moves}>{scramble.join(" ")}</span>
      <button
        className={styles.refresh}
        onClick={regenerate}
        aria-label="Generate a new scramble"
        title="New scramble"
      >
        ↻
      </button>
    </div>
  );
}
