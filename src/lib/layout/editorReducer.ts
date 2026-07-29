import { DEFAULT_HUD_LAYOUT } from "./defaults";
import {
  clampRect,
  layoutEquals,
  minimumSizeForItem,
  resizeRect,
  resizeRectLocked,
  resizeRectWidthOnly,
  snapRect,
} from "./geometry";
import { clearHudLayout, saveHudLayout } from "./storage";
import type { HudLayout, LayoutItemId, LayoutRect, NormalizedPoint, ResizeHandle, ViewportSize } from "./types";

/** Pointer data accompanying an interaction-related action. */
export type PointerPayload = {
  clientX: number;
  clientY: number;
  viewport: ViewportSize;
};

/** Transient state for a drag or resize in progress. Kept apart from `HudLayout`. */
export type ActiveInteraction = {
  item: LayoutItemId;
  handle: ResizeHandle | null;
  originClientX: number;
  originClientY: number;
  originRect: LayoutRect;
  /** True once the current pointer position has engaged magnetic snapping. */
  snapped: boolean;
  /**
   * The panel's TRUE measured content aspect ratio (width/height), for
   * aspect-locked items (timer/cube) only. When provided, resizing locks to
   * this instead of `originRect`'s own ratio, so the saved rect's ratio
   * always exactly matches what's actually rendered — otherwise a saved
   * rect with a slightly different ratio than the content's real one can
   * leave the true displayed box smaller than the saved rect on one axis.
   */
  aspectRatio?: number;
};

export type EditorState = {
  editing: boolean;
  disabled: boolean;
  layout: HudLayout;
  interaction: ActiveInteraction | null;
  /** Increments each time `layout` is committed (interaction end or reset). */
  revision: number;
};

export type EditorAction =
  | { type: "SET_DISABLED"; disabled: boolean }
  | { type: "TOGGLE_EDIT" }
  | ({ type: "START_DRAG"; item: LayoutItemId } & PointerPayload)
  | ({
      type: "START_RESIZE";
      item: LayoutItemId;
      handle: ResizeHandle;
      aspectRatio?: number;
    } & PointerPayload)
  | ({ type: "MOVE" } & PointerPayload)
  | { type: "END_INTERACTION" }
  | { type: "RESET" }
  | { type: "SYNC_LAYOUT"; layout: HudLayout };

function cloneLayout(layout: HudLayout): HudLayout {
  return {
    sidebar: { ...layout.sidebar },
    timer: { ...layout.timer },
    cube: { ...layout.cube },
    leftZone: { ...layout.leftZone },
    rightZone: { ...layout.rightZone },
  };
}

/** Creates the initial reducer state around a caller-supplied base layout. */
export function createEditorState(layout: HudLayout, disabled = false): EditorState {
  return {
    editing: false,
    disabled,
    layout: cloneLayout(layout),
    interaction: null,
    revision: 0,
  };
}

/** The corner a given resize handle drags, in the rectangle's own coordinates. */
function cornerPoint(rect: LayoutRect, handle: ResizeHandle): NormalizedPoint {
  return {
    x: handle === "top-right" || handle === "bottom-right" ? rect.x + rect.width : rect.x,
    y: handle === "bottom-left" || handle === "bottom-right" ? rect.y + rect.height : rect.y,
  };
}

function applyMove(state: EditorState, action: Extract<EditorAction, { type: "MOVE" }>): EditorState {
  const interaction = state.interaction;
  if (!interaction) {
    return state;
  }

  const dx = (action.clientX - interaction.originClientX) / action.viewport.width;
  const dy = (action.clientY - interaction.originClientY) / action.viewport.height;
  const minSize = minimumSizeForItem(interaction.item);

  let rawRect: LayoutRect;
  if (interaction.handle) {
    const point = {
      x: cornerPoint(interaction.originRect, interaction.handle).x + dx,
      y: cornerPoint(interaction.originRect, interaction.handle).y + dy,
    };
    // The sidebar's height must stay intrinsic to its content (it grows on
    // its own as history accumulates), so only its width is draggable.
    // Timer/cube keep their aspect ratio; the hand-detection zones resize
    // freely in both dimensions.
    if (interaction.item === "sidebar") {
      rawRect = resizeRectWidthOnly(interaction.originRect, interaction.handle, point, minSize);
    } else if (interaction.item === "timer" || interaction.item === "cube") {
      rawRect = resizeRectLocked(
        interaction.originRect,
        interaction.handle,
        point,
        minSize,
        minSize,
        interaction.aspectRatio,
      );
    } else {
      rawRect = resizeRect(interaction.originRect, interaction.handle, point, minSize, minSize);
    }
  } else {
    rawRect = {
      ...interaction.originRect,
      x: interaction.originRect.x + dx,
      y: interaction.originRect.y + dy,
    };
  }

  const clamped = clampRect(rawRect, minSize, minSize);
  const snappedRect = snapRect(clamped, action.viewport);
  const snapped = snappedRect.x !== clamped.x || snappedRect.y !== clamped.y;

  return {
    ...state,
    interaction: { ...interaction, snapped },
    layout: { ...state.layout, [interaction.item]: snappedRect },
  };
}

/** Pure reducer for HUD layout edit-mode interactions. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_DISABLED": {
      if (action.disabled === state.disabled) {
        return state;
      }
      return action.disabled
        ? { ...state, disabled: true, editing: false, interaction: null }
        : { ...state, disabled: false };
    }
    case "TOGGLE_EDIT": {
      if (state.disabled) {
        return state;
      }
      return state.editing
        ? { ...state, editing: false, interaction: null }
        : { ...state, editing: true };
    }
    case "START_DRAG": {
      if (!state.editing || state.disabled) {
        return state;
      }
      return {
        ...state,
        interaction: {
          item: action.item,
          handle: null,
          originClientX: action.clientX,
          originClientY: action.clientY,
          originRect: state.layout[action.item],
          snapped: false,
        },
      };
    }
    case "START_RESIZE": {
      if (!state.editing || state.disabled) {
        return state;
      }
      return {
        ...state,
        interaction: {
          item: action.item,
          handle: action.handle,
          originClientX: action.clientX,
          originClientY: action.clientY,
          originRect: state.layout[action.item],
          snapped: false,
          aspectRatio: action.aspectRatio,
        },
      };
    }
    case "MOVE":
      return applyMove(state, action);
    case "END_INTERACTION": {
      if (!state.interaction) {
        return state;
      }
      const next: EditorState = { ...state, interaction: null, revision: state.revision + 1 };
      saveHudLayout(next.layout);
      return next;
    }
    case "RESET": {
      const layout = cloneLayout(DEFAULT_HUD_LAYOUT);
      clearHudLayout();
      return { ...state, layout, interaction: null, revision: state.revision + 1 };
    }
    case "SYNC_LAYOUT": {
      if (state.interaction) {
        return state;
      }
      // Bail out (same reference) when the incoming layout already matches
      // by value. Callers that mirror `state.layout` back in as a prop
      // (e.g. to derive rendering from it) always pass a fresh clone even
      // when nothing changed; without this check, that would create a new
      // `state.layout` reference, which fires the caller's own effect
      // again, which SYNC_LAYOUTs again — an infinite loop.
      if (layoutEquals(state.layout, action.layout)) {
        return state;
      }
      return { ...state, layout: cloneLayout(action.layout) };
    }
    default:
      return state;
  }
}

/** Reset is only meaningful in edit mode once the layout has actually changed. */
export function selectShowReset(state: EditorState): boolean {
  return state.editing && !layoutEquals(state.layout, DEFAULT_HUD_LAYOUT);
}
