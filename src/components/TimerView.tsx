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
import { ScrambleStrip } from "./Cube/ScrambleStrip";
import { CubePanel } from "./Cube/CubePanel";
import { soundManager } from "@/lib/audio/sounds";
import styles from "./TimerView.module.css";

export function TimerView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vision = useHandVision(videoRef);
  useTimerDriver(vision);
  const phase = useTimerStore((s) => s.phase);
  const solves = useTimerStore((s) => s.solves);
  const clearHistory = useTimerStore((s) => s.clearHistory);
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

      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.title}>RUBIX</span>
            <div
              className={styles.status}
              title={vision.error ?? undefined}
            >
              {vision.error
                ? "error"
                : !vision.ready
                  ? "loading vision"
                  : "● LIVE"}
            </div>
          </div>
          {solves.length > 0 && (
            <button
              onClick={() => {
                clearHistory();
                soundManager.play("ui");
              }}
              className={styles.clearBtn}
            >
              CLEAR
            </button>
          )}
        </div>
        <div className={styles.statsBar}>
          <Stats />
        </div>
        <div className={styles.historyBox}>
          <History />
        </div>
      </aside>

      <main className={styles.center}>
        <TimerScreen>
          <ScrambleStrip />
          <HandIndicators zones={vision.smoothedZones} />
          <Digits />
        </TimerScreen>
      </main>

      <aside className={styles.cubeBox}>
        <CubePanel />
      </aside>
    </div>
  );
}
