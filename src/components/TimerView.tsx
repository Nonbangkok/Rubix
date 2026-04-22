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
        <span className={styles.title}>RUBIX · STACKMAT</span>
      </header>

      <main className={styles.center}>
        <TimerScreen>
          <HandIndicators zones={vision.smoothedZones} />
          <Digits />
        </TimerScreen>
      </main>

      <p className={styles.hint}>
        Place both hands on pads · hold 500ms · lift to start. Spacebar as
        fallback.
      </p>

      <footer className={styles.statsBar}>
        <Stats />
      </footer>
    </div>
  );
}
