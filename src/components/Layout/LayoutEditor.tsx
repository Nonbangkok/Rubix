"use client";

import { useEffect, useReducer, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  createEditorState,
  editorReducer,
  selectShowReset,
} from "@/lib/layout/editorReducer";
import {
  cameraRectToScreenRect,
  mirrorHandleX,
  mirrorRectX,
  screenPointToCameraPoint,
} from "@/lib/layout/geometry";
import type {
  CameraMapping,
  HudLayout,
  LayoutItemId,
  LayoutRect,
  ResizeHandle,
  ViewportSize,
} from "@/lib/layout/types";
import styles from "./LayoutEditor.module.css";

export type PanelId = "sidebar" | "timer" | "cube";

const PANEL_IDS: readonly PanelId[] = ["sidebar", "timer", "cube"];
const ZONE_IDS: readonly LayoutItemId[] = ["leftZone", "rightZone"];
const OVERLAY_IDS: readonly LayoutItemId[] = [...PANEL_IDS, ...ZONE_IDS];
const RESIZE_HANDLES: readonly ResizeHandle[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

// The hand-detection zones' overlay boxes are rendered and dragged in
// mirrored screen space (see `isMirrored`/`mirrorRectX` below) because the
// camera preview itself is horizontally flipped via CSS. Panels are not.
const MIRRORED_ITEMS = new Set<LayoutItemId>(["leftZone", "rightZone"]);

function isMirrored(id: LayoutItemId): boolean {
  return MIRRORED_ITEMS.has(id);
}

const HANDLE_CLASS: Record<ResizeHandle, string> = {
  "top-left": styles.handleTopLeft,
  "top-right": styles.handleTopRight,
  "bottom-left": styles.handleBottomLeft,
  "bottom-right": styles.handleBottomRight,
};

// The internal keys (`leftZone`/`rightZone`) name the raw, un-mirrored
// camera-frame rectangle. Because the preview is mirrored horizontally for
// display, the raw `leftZone` rect actually appears on the RIGHT of the
// screen (and, via `pad.ts`'s cross-assignment, drives the right-hand
// state) — so the label text is intentionally the opposite of the key name.
const ZONE_LABEL: Partial<Record<LayoutItemId, string>> = {
  leftZone: "Right hand zone",
  rightZone: "Left hand zone",
};

type LayoutEditorProps = {
  layout: HudLayout;
  onLayoutChange: (layout: HudLayout) => void;
  disabled: boolean;
  /** The camera's native resolution, once known (see `VisionPreview`'s
   * `object-cover`). Until it's measured, zone editing falls back to a
   * plain mirror with no crop correction. */
  cameraSize?: { width: number; height: number };
  /**
   * The panel's ACTUAL current rendered footprint, measured by TimerView
   * (which owns the real DOM nodes). Panel content is aspect-locked and
   * uniformly scaled to fit inside `layout[id]` without distorting it,
   * which can leave it smaller than the saved rect on one axis (e.g. the
   * saved rect's aspect ratio doesn't exactly match the content's true
   * one), and the sidebar's height is intrinsic/auto rather than a value
   * that's ever "resized" to. The edit-mode overlay always shows this
   * actual box rather than the saved target, since it exists purely to
   * show the user what they're editing without lying about size —
   * falls back to `layout[id]` for any item not yet measured (e.g. on
   * first paint, before layout effects run).
   */
  panelDisplayRects?: Partial<Record<PanelId, LayoutRect>>;
  children: (itemStyle: (id: PanelId) => CSSProperties) => ReactNode;
};

function rectStyle(rect: LayoutRect): CSSProperties {
  return {
    position: "fixed",
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Converts a real screen pointer position into the pixel-space the reducer
 * expects for a mirrored (zone) item, so its existing
 * `(clientX - originClientX) / viewport.width` delta math yields the
 * correct movement in camera-frame fraction units. Without a known camera
 * size this is a plain mirror (`viewportWidth - clientX`); with one, it
 * additionally undoes `object-cover`'s crop via `screenPointToCameraPoint`.
 */
function toMirroredReducerPoint(
  clientX: number,
  clientY: number,
  viewport: ViewportSize,
  cam: CameraMapping | null,
): { x: number; y: number } {
  if (!cam) {
    return { x: viewport.width - clientX, y: clientY };
  }
  const cameraPoint = screenPointToCameraPoint(
    { x: clientX / viewport.width, y: clientY / viewport.height },
    cam,
  );
  return { x: cameraPoint.x * viewport.width, y: cameraPoint.y * viewport.height };
}

// Panel content (sidebar/timer/cube) is sized internally in vmin units,
// independent of this wrapper's box. This only positions the wrapper;
// TimerView measures each panel's natural rendered size and applies its
// own `transform: scale(...)` to match the current (possibly resized)
// rectangle — see `useNaturalSize` there for why a static assumed size
// isn't accurate enough to scale from.
function panelPositionStyle(rect: LayoutRect): CSSProperties {
  return {
    position: "fixed",
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
  };
}

export function LayoutEditor({
  layout,
  onLayoutChange,
  disabled,
  cameraSize,
  panelDisplayRects,
  children,
}: LayoutEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createEditorState(layout, disabled),
  );

  // Keep the reducer's working copy in step with an externally-changed base
  // layout (e.g. hydrated from storage after mount), but never clobber a
  // drag or resize that's already in progress.
  const layoutRef = useRef(layout);
  useEffect(() => {
    if (layoutRef.current !== layout) {
      layoutRef.current = layout;
      dispatch({ type: "SYNC_LAYOUT", layout });
    }
  }, [layout]);

  useEffect(() => {
    dispatch({ type: "SET_DISABLED", disabled });
  }, [disabled]);

  // Notify the parent on every layout change WHILE an interaction is active
  // (not just on commit), so panel content the parent sizes from its own
  // `layout` prop (e.g. TimerView's natural-size-based scale for
  // timer/cube, or the sidebar's real width) tracks a drag in real time
  // instead of jumping only once the gesture ends. This is only safe
  // during an interaction, because `SYNC_LAYOUT` (below) unconditionally
  // ignores the resulting round-trip while `state.interaction` is set —
  // outside of that, echoing a fresh-but-value-equal layout back in would
  // otherwise risk ping-ponging indefinitely, so idle changes stay gated to
  // real commits (revision bumps: interaction end or reset).
  const lastRevision = useRef(state.revision);
  useEffect(() => {
    const isCommit = state.revision !== lastRevision.current;
    if (isCommit) {
      lastRevision.current = state.revision;
    }
    if (state.interaction || isCommit) {
      onLayoutChange(state.layout);
    }
  }, [state.layout, state.interaction, state.revision, onLayoutChange]);

  const itemStyle = (id: PanelId): CSSProperties => panelPositionStyle(state.layout[id]);

  const cameraMapping = (viewport: ViewportSize): CameraMapping | null =>
    cameraSize
      ? {
          videoWidth: cameraSize.width,
          videoHeight: cameraSize.height,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        }
      : null;

  const startDrag =
    (item: LayoutItemId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const viewport = currentViewport();
      const point = isMirrored(item)
        ? toMirroredReducerPoint(event.clientX, event.clientY, viewport, cameraMapping(viewport))
        : { x: event.clientX, y: event.clientY };
      dispatch({
        type: "START_DRAG",
        item,
        clientX: point.x,
        clientY: point.y,
        viewport,
      });
    };

  const startResize =
    (item: LayoutItemId, handle: ResizeHandle) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const viewport = currentViewport();
      const point = isMirrored(item)
        ? toMirroredReducerPoint(event.clientX, event.clientY, viewport, cameraMapping(viewport))
        : { x: event.clientX, y: event.clientY };
      // A mirrored (displayed) box's visually-top-left handle corresponds to
      // the raw rectangle's top-right corner, so translate the handle too.
      const rawHandle = isMirrored(item) ? mirrorHandleX(handle) : handle;
      dispatch({
        type: "START_RESIZE",
        item,
        handle: rawHandle,
        clientX: point.x,
        clientY: point.y,
        viewport,
      });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!state.interaction) return;
    event.stopPropagation();
    const viewport = currentViewport();
    const point = isMirrored(state.interaction.item)
      ? toMirroredReducerPoint(event.clientX, event.clientY, viewport, cameraMapping(viewport))
      : { x: event.clientX, y: event.clientY };
    dispatch({
      type: "MOVE",
      clientX: point.x,
      clientY: point.y,
      viewport,
    });
  };

  const endInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!state.interaction) return;
    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be gone (e.g. pointercancel fired first).
    }
    dispatch({ type: "END_INTERACTION" });
  };

  const showReset = selectShowReset(state);

  const zoneDisplayRect = (id: LayoutItemId): LayoutRect => {
    const cam = cameraMapping(currentViewport());
    return cam ? cameraRectToScreenRect(state.layout[id], cam) : mirrorRectX(state.layout[id]);
  };

  return (
    <>
      {children(itemStyle)}

      {!disabled && state.editing && (
        <div className={styles.overlayLayer}>
          {OVERLAY_IDS.map((id) => {
            const isZone = id === "leftZone" || id === "rightZone";
            const isActive = state.interaction?.item === id;
            const isSnapped = Boolean(isActive && state.interaction?.snapped);
            const overlayClassName = [
              styles.overlay,
              isZone ? styles.zoneOverlay : "",
              isActive ? styles.overlayActive : "",
              isSnapped ? styles.snapHighlight : "",
            ]
              .filter(Boolean)
              .join(" ");

            const displayRect = isMirrored(id)
              ? zoneDisplayRect(id)
              : (panelDisplayRects?.[id as PanelId] ?? state.layout[id]);

            return (
              <div
                key={id}
                className={overlayClassName}
                style={rectStyle(displayRect)}
                onPointerDown={startDrag(id)}
                onPointerMove={handleMove}
                onPointerUp={endInteraction}
                onPointerCancel={endInteraction}
                onLostPointerCapture={endInteraction}
              >
                {ZONE_LABEL[id] && <span className={styles.zoneLabel}>{ZONE_LABEL[id]}</span>}
                {RESIZE_HANDLES.map((handle) => (
                  <div
                    key={handle}
                    className={`${styles.handle} ${HANDLE_CLASS[handle]}`}
                    onPointerDown={startResize(id, handle)}
                    onPointerMove={handleMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                    onLostPointerCapture={endInteraction}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div className={styles.controls}>
          {showReset && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => dispatch({ type: "RESET" })}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className={styles.pencilButton}
            aria-label={state.editing ? "Finish editing layout" : "Edit layout"}
            aria-pressed={state.editing}
            onClick={() => dispatch({ type: "TOGGLE_EDIT" })}
          >
            <PencilIcon />
          </button>
        </div>
      )}
    </>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m14 6 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
