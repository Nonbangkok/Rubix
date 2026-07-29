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

// The camera's native resolution, needed so LayoutEditor can correctly place
// the hand-detection zone overlays under VisionPreview's `object-cover`
// video (see LayoutEditor's `cameraSize` prop). Unknown (zero) until the
// stream actually starts.
function useVideoSize(videoRef: RefObject<HTMLVideoElement | null>): Size {
  const [size, setSize] = useState<Size>(ZERO_SIZE);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      if (video.videoWidth && video.videoHeight) {
        setSize({ width: video.videoWidth, height: video.videoHeight });
      }
    };
    update();
    video.addEventListener("loadedmetadata", update);
    return () => video.removeEventListener("loadedmetadata", update);
  }, [videoRef]);

  return size;
}

// A single uniform factor, not independent scaleX/scaleY: panels are
// aspect-locked when resized, but the saved rect's ratio can still differ
// slightly from the content's true measured ratio, and scaling each axis
// independently would stretch circles into ellipses. `min` keeps the
// content fully inside the target box rather than overflowing it — which
// means the actual rendered box can end up smaller than the saved rect on
// one axis; `panelDisplayRect` below reports that true footprint so the
// edit-mode overlay never shows a box bigger than what's really there.
function panelScale(rect: LayoutRect, natural: Size, viewport: Size): number | null {
  if (!natural.width || !natural.height || !viewport.width || !viewport.height) {
    return null;
  }
  const scaleX = (rect.width * viewport.width) / natural.width;
  const scaleY = (rect.height * viewport.height) / natural.height;
  return Math.min(scaleX, scaleY);
}

function scaleStyle(scale: number | null): CSSProperties {
  return scale === null ? {} : { transform: `scale(${scale})`, transformOrigin: "top left" };
}

function panelDisplayRect(
  rect: LayoutRect,
  natural: Size,
  scale: number | null,
  viewport: Size,
): LayoutRect | undefined {
  if (scale === null || !viewport.width || !viewport.height) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: (natural.width * scale) / viewport.width,
    height: (natural.height * scale) / viewport.height,
  };
}

function sidebarDisplayRect(rect: LayoutRect, natural: Size, viewport: Size): LayoutRect | undefined {
  if (!natural.height || !viewport.height) return undefined;
  // Width is real CSS (not scaled), so it already equals `rect.width`;
  // height is intrinsic/auto, so only the measured value reflects reality.
  return { x: rect.x, y: rect.y, width: rect.width, height: natural.height / viewport.height };
}

const RECT_EPSILON = 1e-6;

function rectsClose(a: LayoutRect, b: LayoutRect): boolean {
  return (
    Math.abs(a.x - b.x) < RECT_EPSILON &&
    Math.abs(a.y - b.y) < RECT_EPSILON &&
    Math.abs(a.width - b.width) < RECT_EPSILON &&
    Math.abs(a.height - b.height) < RECT_EPSILON
  );
}

/**
 * Self-heals a saved rect whose aspect ratio doesn't exactly match the
 * panel's true measured content ratio (e.g. an imprecise default, or one
 * saved before `resizeRectLocked` started accepting an aspect override) so
 * it always matches what's actually rendered — without this, dragging
 * (rather than resizing) a still-imprecise panel toward a screen edge would
 * always stop visibly short of it, since only a *resize* recomputes the
 * rect from the true aspect ratio.
 *
 * Depends on the rect's own fields (not just natural size/viewport) so it
 * re-checks after `layout` is replaced by the localStorage hydration effect
 * (which can happen after natural size is first measured, overwriting an
 * already-corrected default with a still-imprecise saved value). This can't
 * loop or fight an in-progress drag: it's a no-op once `corrected` already
 * matches the current rect, which — since correcting an already-correct
 * rect is a fixed point of this formula — is true immediately after any
 * correction, and true throughout a drag/resize once a panel has been
 * corrected once (position-only moves don't change width/height, and
 * aspect-locked resizes already keep the true ratio via `resizeRectLocked`'s
 * `aspectOverride`).
 */
function useAspectSelfHeal(
  panelId: "timer" | "cube",
  rect: LayoutRect,
  natural: Size,
  viewport: Size,
  setLayout: (updater: (prev: HudLayout) => HudLayout) => void,
  // Which horizontal edge to keep fixed when the correction shrinks the
  // width: "left" preserves `x` (timer), "right" preserves `x + width` (the
  // cube's default position is flush against the right screen edge, and
  // should stay flush there even if the natural aspect ratio means only the
  // width, not the height, needs correcting).
  xAnchor: "left" | "right" = "left",
) {
  useEffect(() => {
    if (!natural.width || !natural.height || !viewport.width || !viewport.height) return;
    setLayout((prev) => {
      const current = prev[panelId];
      const scale = panelScale(current, natural, viewport);
      if (scale === null) return prev;
      const width = (natural.width * scale) / viewport.width;
      const height = (natural.height * scale) / viewport.height;
      const x = xAnchor === "right" ? current.x + current.width - width : current.x;
      const corrected: LayoutRect = { x, y: current.y, width, height };
      if (rectsClose(corrected, current)) return prev;
      return { ...prev, [panelId]: corrected };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    panelId,
    xAnchor,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    natural.width,
    natural.height,
    viewport.width,
    viewport.height,
    setLayout,
  ]);
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
  const videoSize = useVideoSize(videoRef);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<HTMLElement | null>(null);
  const cubeRef = useRef<HTMLElement | null>(null);
  const sidebarNatural = useNaturalSize(sidebarRef);
  const timerNatural = useNaturalSize(timerRef);
  const cubeNatural = useNaturalSize(cubeRef);

  useAspectSelfHeal("timer", layout.timer, timerNatural, viewport, setLayout);
  useAspectSelfHeal("cube", layout.cube, cubeNatural, viewport, setLayout, "right");

  const timerScale = panelScale(layout.timer, timerNatural, viewport);
  const cubeScale = panelScale(layout.cube, cubeNatural, viewport);
  const panelDisplayRects = {
    sidebar: sidebarDisplayRect(layout.sidebar, sidebarNatural, viewport),
    timer: panelDisplayRect(layout.timer, timerNatural, timerScale, viewport),
    cube: panelDisplayRect(layout.cube, cubeNatural, cubeScale, viewport),
  };

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
        cameraSize={videoSize.width && videoSize.height ? videoSize : undefined}
        panelDisplayRects={panelDisplayRects}
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
              ref={sidebarRef}
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
                  : { ...itemStyle("timer"), ...scaleStyle(timerScale) }
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
              style={{ ...itemStyle("cube"), ...scaleStyle(cubeScale) }}
            >
              <CubePanel />
            </aside>
          </>
        )}
      </LayoutEditor>
    </div>
  );
}
