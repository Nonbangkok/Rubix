"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutEditor } from "./Layout/LayoutEditor";
import { DEFAULT_HUD_LAYOUT } from "@/lib/layout/defaults";
import { loadHudLayout } from "@/lib/layout/storage";
import { canEditLayout } from "@/lib/layout/visibility";
import type { HudLayout } from "@/lib/layout/types";
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
  const [layout, setLayout] = useState<HudLayout>(DEFAULT_HUD_LAYOUT);

  // Layout is read from localStorage only after mount so the server-rendered
  // markup and the first client render both start from the same defaults,
  // avoiding a hydration mismatch.
  useEffect(() => {
    setLayout(loadHudLayout());
  }, []);

  const zones = { leftZone: layout.leftZone, rightZone: layout.rightZone };
  const vision = useHandVision(videoRef, zones);
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
        zones={zones}
        className={styles.camera}
      />

      <LayoutEditor
        layout={layout}
        onLayoutChange={setLayout}
        disabled={!canEditLayout(phase)}
      >
        {(itemStyle) => (
          <>
            <aside className={styles.sidebar} style={itemStyle("sidebar")}>
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
                        : !vision.started
                          ? "starting engine..."
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

            {/*
              Focus mode (RUNNING) keeps its own centered/scaled position via
              the `.focus .center` CSS rule. Applying the editor's inline
              top/left/width/height there would win over that class rule
              (inline styles beat class rules for the same properties), so
              we skip the editor's inline style while focused and fall back
              to plain className-based positioning instead.
            */}
            <main
              className={styles.center}
              style={focusMode ? undefined : itemStyle("timer")}
            >
              <TimerScreen>
                <ScrambleStrip />
                <HandIndicators zones={vision.smoothedZones} />
                <Digits />
              </TimerScreen>
            </main>

            <aside className={styles.cubeBox} style={itemStyle("cube")}>
              <CubePanel />
            </aside>
          </>
        )}
      </LayoutEditor>
    </div>
  );
}
