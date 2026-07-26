# Customizable HUD Layout Design

## Goal

Allow each user to arrange the Rubix Timer HUD for their own camera setup. The user can drag and resize the three top-level HUD panels and the two hand-detection zones. The layout is retained in browser `localStorage` and directly affects live hand detection.

## Scope

Five independently configurable layout items:

| ID | Item | Resize scope |
| --- | --- | --- |
| `sidebar` | Statistics and solve history panel | Whole panel only |
| `timer` | Timer panel, including scramble, hand indicators, and digits | Whole panel only |
| `cube` | Cube panel | Whole panel only |
| `leftZone` | Left hand-detection zone | Entire detection rectangle |
| `rightZone` | Right hand-detection zone | Entire detection rectangle |

Nested HUD elements are not independently configurable.

## Interaction Design

### Edit mode

- A floating pencil button in the bottom-right corner enters and exits edit mode.
- The pencil is available only when the timer phase is not `RUNNING`.
- In edit mode, all five configurable items show a visible editing outline and resize handles.
- Items can be dragged using Pointer Events, supporting mouse and touch input.
- Pointer interaction for editing is enabled only in edit mode. Normal controls, including cube interaction, retain their existing behavior outside edit mode.
- The user leaves edit mode through the same pencil control or a clear completion action attached to the editor UI.

### Resize and placement

- Each item has a minimum usable size and is clamped to the viewport, so it cannot be reduced to an unusable size or moved outside the visible screen.
- Position and size are represented as percentages of viewport width and height. This preserves the relative arrangement when the viewport size changes.
- During dragging, an item magnetically snaps when close to one of eight standard placements: top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, and bottom-right.
- Snapping is assistive rather than restrictive: users may place an item freely anywhere else.
- The snap calculation uses the dragged item’s bounds, so it stays correct after resizing.

### Reset

- The editor detects whether the stored layout differs from the default layout.
- A Reset control is shown only while edit mode is open and a custom layout exists.
- Reset restores all five items together to the default layout and removes or replaces the stored custom value. The Reset control then disappears.

### Timer focus mode

- Custom layout applies while the timer is not running.
- During `RUNNING`, the existing focus behavior remains unchanged: the timer moves and scales to its current focus position, while the sidebar and cube panel are hidden.
- Focus mode neither overwrites nor persists any custom layout values.

## Architecture

### Layout state

Introduce a focused layout module responsible for:

- Default layouts derived from the current HUD placement and current detection-zone constants.
- A versioned `localStorage` record containing the five normalized rectangles.
- Validation, clamping, equality comparison against defaults, reset, and persistence.
- Safe fallback to defaults when storage is absent, malformed, or contains out-of-range data.

Each normalized rectangle has:

```ts
type LayoutRect = {
  x: number;      // percentage from viewport left
  y: number;      // percentage from viewport top
  width: number;  // percentage of viewport width
  height: number; // percentage of viewport height
};
```

### Editor UI

`LayoutEditor` provides edit-mode state and reusable draggable/resizable wrappers for the three HUD panels. It applies normalized rectangles as fixed-position styles and owns pointer capture, resize handles, snapping feedback, and persistence on completed interactions.

The existing `TimerView` remains responsible for composing the camera, sidebar, timer, and cube. It supplies each major panel to the editor wrapper instead of hard-coding their fixed CSS positions.

### Hand-detection zones

The configurable zone rectangles use the same normalized coordinate space as the vision layer. The vision engine receives the current `leftZone` and `rightZone` values instead of static constants, and `VisionPreview` draws those same values. This keeps visual frames and real MediaPipe hit testing aligned.

Handedness mapping remains consistent with the current mirrored camera behavior; only the zone geometry becomes configurable.

## Data Flow

1. On client startup, load and validate the versioned layout record from `localStorage`.
2. If valid, render the five stored rectangles; otherwise use defaults.
3. In edit mode, pointer movement updates temporary layout state and evaluates magnetic snap targets.
4. On drag or resize completion, clamp the result and persist the complete layout record.
5. Pass the current detection-zone rectangles to both the camera overlay and the hand-detection code.
6. On Reset, restore default values for all five entries and update storage.
7. On `RUNNING`, render the existing focus-mode presentation without mutating stored layout state.

## Error Handling

- Access to `localStorage` is client-only and wrapped so unavailable or invalid storage cannot prevent timer startup.
- Invalid, incomplete, non-finite, or out-of-bounds stored values are discarded in favor of defaults.
- Pointer cancellation and lost capture end an interaction safely without leaving the editor in a dragging state.
- Minimum dimensions and viewport clamping protect both panel usability and hand-detection reliability.

## Verification

- Unit tests for validation, normalization, clamping, snap target selection, custom-layout detection, and reset.
- Component tests for entering/exiting edit mode, drag/resize persistence, conditional Reset visibility, and `RUNNING` edit control suppression.
- Vision tests confirming edited zone rectangles are passed to detection and rendered identically in the preview.
- Manual desktop and touch-device checks for all eight snap positions, free placement, resize constraints, browser reload restoration, and preservation of existing timer focus behavior.

## Non-goals

- No per-child customization inside the sidebar, timer, or cube panels.
- No cloud synchronization or sharing of layouts.
- No layout editing while the timer is running.
