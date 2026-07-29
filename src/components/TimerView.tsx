"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { LayoutEditor } from "./Layout/LayoutEditor";
import { DEFAULT_HUD_LAYOUT } from "@/lib/layout/defaults";
import { loadHudLayout } from "@/lib/layout/storage";
import { canEditLayout } from "@/lib/layout/visibility";
import type { HudLayout, LayoutRect } from "@/lib/layout/types";
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

type Size = { width: number; height: number };
const ZERO_SIZE: Size = { width: 0, height: 0 };

// Timer/cube content is sized in vmin units, independent of the resizable
// box LayoutEditor positions it at — so a resized box doesn't make the
// visible content bigger on its own. Measure each panel's real rendered
// footprint (border box, to include its own padding/border) and scale the
// whole element to match the saved rect exactly. (The sidebar doesn't use
// this — see its own comment below.)
function useNaturalSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>(ZERO_SIZE);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      setSize(
        box
          ? { width: box.inlineSize, height: box.blockSize }
          : { width: entry.contentRect.width, height: entry.contentRect.height },
      );
    });
    observer.observe(el, { box: "border-box" });
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function useViewportSize(): Size {
  const [size, setSize] = useState<Size>(ZERO_SIZE);

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

function scaleStyle(rect: LayoutRect, natural: Size, viewport: Size): CSSProperties {
  if (!natural.width || !natural.height || !viewport.width || !viewport.height) {
    // Not measured yet (e.g. first paint) — render at natural size rather
    // than guessing, so there's never a visibly wrong scale.
    return {};
  }
  const scaleX = (rect.width * viewport.width) / natural.width;
  const scaleY = (rect.height * viewport.height) / natural.height;
  return { transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: "top left" };
}

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

  const viewport = useViewportSize();
  const timerRef = useRef<HTMLElement | null>(null);
  const cubeRef = useRef<HTMLElement | null>(null);
  const timerNatural = useNaturalSize(timerRef);
  const cubeNatural = useNaturalSize(cubeRef);

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
            {/*
              The sidebar's height is intentionally intrinsic — it grows on
              its own as solve history accumulates — so only width comes
              from the saved rect (as a real CSS width, not a transform),
              and no scaling is applied to it at all (its text stays at its
              natural, un-scaled size regardless of resize).
            */}
            <aside
              className={styles.sidebar}
              style={{ ...itemStyle("sidebar"), width: `${layout.sidebar.width * 100}%` }}
            >
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
              ref={timerRef}
              className={styles.center}
              style={
                focusMode
                  ? undefined
                  : { ...itemStyle("timer"), ...scaleStyle(layout.timer, timerNatural, viewport) }
              }
            >
              <TimerScreen>
                <ScrambleStrip />
                <HandIndicators zones={vision.smoothedZones} />
                <Digits />
              </TimerScreen>
            </main>

            <aside
              ref={cubeRef}
              className={styles.cubeBox}
              style={{ ...itemStyle("cube"), ...scaleStyle(layout.cube, cubeNatural, viewport) }}
            >
              <CubePanel />
            </aside>
          </>
        )}
      </LayoutEditor>
    </div>
  );
}
