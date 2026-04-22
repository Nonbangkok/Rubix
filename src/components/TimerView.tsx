"use client";

import { useRef } from "react";
import { useHandVision } from "@/lib/vision/useHandVision";
import { useTimerDriver } from "@/lib/timer/useTimerDriver";
import { useTimerStore } from "@/lib/timer/store";
import { VisionPreview } from "./VisionPreview";
import { Digits } from "./Timer/Digits";
import { HandIndicators } from "./Timer/HandIndicators";
import { TimerScreen } from "./Timer/TimerScreen";
import { Stats } from "./Timer/Stats";
import { History } from "./Timer/History";
import styles from "./TimerView.module.css";

export function TimerView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vision = useHandVision(videoRef);
  useTimerDriver(vision);
  const phase = useTimerStore((s) => s.phase);
  const focusMode = phase === "RUNNING";

  return (
    <div
      className={`${styles.stage} ${focusMode ? styles.focus : ""}`}
      style={{ touchAction: "none" }}
    >
      <VisionPreview
        state={vision}
        videoRef={videoRef}
        className={styles.camera}
      />

      <header className={styles.header}>
        <span className={styles.title}>RUBIX</span>
      </header>

      <main className={styles.center}>
        <TimerScreen>
          <HandIndicators zones={vision.smoothedZones} />
          <Digits />
        </TimerScreen>
      </main>

      <footer className={styles.statsBar}>
        <Stats />
      </footer>

      <aside className={styles.historyBox}>
        <History />
      </aside>
    </div>
  );
}
