"use client";

import { useEffect, useReducer, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  createEditorState,
  editorReducer,
  selectShowReset,
} from "@/lib/layout/editorReducer";
import type { HudLayout, LayoutItemId, LayoutRect, ResizeHandle } from "@/lib/layout/types";
import styles from "./LayoutEditor.module.css";

type PanelId = "sidebar" | "timer" | "cube";

const PANEL_IDS: readonly PanelId[] = ["sidebar", "timer", "cube"];
const ZONE_IDS: readonly LayoutItemId[] = ["leftZone", "rightZone"];
const OVERLAY_IDS: readonly LayoutItemId[] = [...PANEL_IDS, ...ZONE_IDS];
const RESIZE_HANDLES: readonly ResizeHandle[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

const HANDLE_CLASS: Record<ResizeHandle, string> = {
  "top-left": styles.handleTopLeft,
  "top-right": styles.handleTopRight,
  "bottom-left": styles.handleBottomLeft,
  "bottom-right": styles.handleBottomRight,
};

const ZONE_LABEL: Partial<Record<LayoutItemId, string>> = {
  leftZone: "Left hand zone",
  rightZone: "Right hand zone",
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

  const itemStyle = (id: PanelId): CSSProperties => rectStyle(state.layout[id]);

  const startDrag =
    (item: LayoutItemId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dispatch({
        type: "START_DRAG",
        item,
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: currentViewport(),
      });
    };

  const startResize =
    (item: LayoutItemId, handle: ResizeHandle) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!state.editing) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dispatch({
        type: "START_RESIZE",
        item,
        handle,
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: currentViewport(),
      });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!state.interaction) return;
    event.stopPropagation();
    dispatch({
      type: "MOVE",
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: currentViewport(),
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

            return (
              <div
                key={id}
                className={overlayClassName}
                style={rectStyle(state.layout[id])}
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
