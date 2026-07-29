"use client";

import { useEffect, useReducer, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  createEditorState,
  editorReducer,
  selectShowReset,
} from "@/lib/layout/editorReducer";
import { DEFAULT_HUD_LAYOUT } from "@/lib/layout/defaults";
import { mirrorHandleX, mirrorRectX } from "@/lib/layout/geometry";
import type { HudLayout, LayoutItemId, LayoutRect, ResizeHandle } from "@/lib/layout/types";
import styles from "./LayoutEditor.module.css";

type PanelId = "sidebar" | "timer" | "cube";

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

// Panel content (sidebar/timer/cube) is sized internally in vmin units
// calibrated to its DEFAULT footprint, so it never stretches to fill a
// resized wrapper on its own. Instead, keep the wrapper at its natural
// default size and visually scale the whole thing — chrome and content
// together — to match the current (possibly resized) rectangle.
function scaledItemStyle(id: PanelId, rect: LayoutRect): CSSProperties {
  const base = DEFAULT_HUD_LAYOUT[id];
  const scaleX = rect.width / base.width;
  const scaleY = rect.height / base.height;
  return {
    position: "fixed",
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${base.width * 100}%`,
    height: `${base.height * 100}%`,
    transform: `scale(${scaleX}, ${scaleY})`,
    transformOrigin: "top left",
  };
}

export function LayoutEditor({ layout, onLayoutChange, disabled, children }: LayoutEditorProps) {
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

  // Notify the parent only when an interaction actually commits (drag/resize
  // end or reset), never on every intermediate pointer move.
  const lastRevision = useRef(state.revision);
  useEffect(() => {
    if (state.revision !== lastRevision.current) {
      lastRevision.current = state.revision;
      onLayoutChange(state.layout);
    }
  }, [state.revision, state.layout, onLayoutChange]);

  const itemStyle = (id: PanelId): CSSProperties => scaledItemStyle(id, state.layout[id]);

  const startDrag =
    (item: LayoutItemId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const viewport = currentViewport();
      const clientX = isMirrored(item) ? viewport.width - event.clientX : event.clientX;
      dispatch({
        type: "START_DRAG",
        item,
        clientX,
        clientY: event.clientY,
        viewport,
      });
    };

  const startResize =
    (item: LayoutItemId, handle: ResizeHandle) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const viewport = currentViewport();
      const clientX = isMirrored(item) ? viewport.width - event.clientX : event.clientX;
      // A mirrored (displayed) box's visually-top-left handle corresponds to
      // the raw rectangle's top-right corner, so translate the handle too.
      const rawHandle = isMirrored(item) ? mirrorHandleX(handle) : handle;
      dispatch({
        type: "START_RESIZE",
        item,
        handle: rawHandle,
        clientX,
        clientY: event.clientY,
        viewport,
      });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!state.interaction) return;
    event.stopPropagation();
    const viewport = currentViewport();
    const clientX = isMirrored(state.interaction.item)
      ? viewport.width - event.clientX
      : event.clientX;
    dispatch({
      type: "MOVE",
      clientX,
      clientY: event.clientY,
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

            const displayRect = isMirrored(id) ? mirrorRectX(state.layout[id]) : state.layout[id];

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
