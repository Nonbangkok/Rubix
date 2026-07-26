# Customizable HUD Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag, resize, magnetically snap, reset, and persist the three HUD panels and two live hand-detection zones.

**Architecture:** Keep layout geometry in a dedicated client-side layout module as normalized viewport rectangles. A `LayoutEditor` owns edit-mode pointer interaction and wraps only the three top-level HUD panels; it also renders the editable detection-zone overlays. The current zone rectangles flow to both `VisionPreview` and `useHandVision`, so the displayed zones exactly match MediaPipe hit testing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, CSS Modules, browser `localStorage`, Vitest.

## Global Constraints

- Persist only a versioned layout record in browser `localStorage`; do not add cloud sync.
- The configurable IDs are exactly `sidebar`, `timer`, `cube`, `leftZone`, and `rightZone`.
- Store all rectangles in normalized viewport coordinates, with `x`, `y`, `width`, and `height` in the inclusive range 0–1.
- Keep existing `RUNNING` focus-mode behavior unchanged and disallow entering edit mode while the timer is `RUNNING`.
- Snap assists near eight placements (four corners and centers of four edges) but never prevents free placement.
- Reset restores every configurable item together and is visible only in edit mode when the current layout differs from defaults.
- Preserve the existing mirrored hand mapping; only detection-zone geometry becomes configurable.

---

## File Structure

- `src/lib/layout/types.ts` — normalized layout IDs, rectangles, and full layout record types.
- `src/lib/layout/defaults.ts` — default geometry that reproduces the present non-running HUD and hand zones.
- `src/lib/layout/geometry.ts` — pure clamp, resize, snapping, conversion, and equality helpers.
- `src/lib/layout/storage.ts` — versioned `localStorage` load/save/reset boundary.
- `src/lib/layout/*.test.ts` — Vitest coverage for pure layout behavior and storage fallbacks.
- `src/components/Layout/LayoutEditor.tsx` — edit-mode state, pointer capture, drag/resize interaction, conditional controls, and layout persistence.
- `src/components/Layout/LayoutEditor.module.css` — edit outline, resize handles, snap feedback, and floating controls.
- `src/components/VisionPreview.tsx` — renders injected, configurable detection zones.
- `src/lib/vision/pad.ts` and `src/lib/vision/useHandVision.ts` — receive injected zones when determining hand-pad state.
- `src/components/TimerView.tsx` and `src/components/TimerView.module.css` — compose panels through the editor and preserve focus mode.
- `package.json`, `vitest.config.ts`, `.gitignore` — test command/dependencies, TypeScript alias handling, and ignored Visual Companion artifacts.

## Task 1: Establish the test harness and repository hygiene

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run test` executing TypeScript unit tests with the `@/` alias resolved to `src/`.

- [ ] **Step 1: Add the failing first layout test file before implementation**

Create `src/lib/layout/geometry.test.ts` with a first expectation for the planned public function:

```ts
import { describe, expect, it } from "vitest";
import { clampRect } from "./geometry";

describe("clampRect", () => {
  it("keeps a rectangle inside the normalized viewport", () => {
    expect(clampRect({ x: -0.2, y: 0.9, width: 0.5, height: 0.4 })).toEqual({
      x: 0,
      y: 0.6,
      width: 0.5,
      height: 0.4,
    });
  });
});
```

- [ ] **Step 2: Configure Vitest and ignore companion artifacts**

Install `vitest` as a development dependency. Add this script to `package.json`:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node" },
});
```

Append `/.superpowers/` to `.gitignore` so Visual Companion sessions remain untracked.

- [ ] **Step 3: Run the first test and verify the expected failure**

Run: `npm run test -- src/lib/layout/geometry.test.ts`

Expected: FAIL because `./geometry` has not been created.

- [ ] **Step 4: Commit the harness setup separately**

```bash
git add package.json package-lock.json vitest.config.ts .gitignore src/lib/layout/geometry.test.ts
git commit -m "test: add vitest layout test harness"
```

## Task 2: Build tested normalized geometry and layout persistence

**Files:**
- Create: `src/lib/layout/types.ts`
- Create: `src/lib/layout/defaults.ts`
- Create: `src/lib/layout/geometry.ts`
- Create: `src/lib/layout/storage.ts`
- Modify: `src/lib/layout/geometry.test.ts`
- Create: `src/lib/layout/storage.test.ts`

**Interfaces:**
- Consumes: Vitest configuration from Task 1.
- Produces:

```ts
export type LayoutItemId = "sidebar" | "timer" | "cube" | "leftZone" | "rightZone";
export type LayoutRect = { x: number; y: number; width: number; height: number };
export type HudLayout = Record<LayoutItemId, LayoutRect>;
export const DEFAULT_HUD_LAYOUT: HudLayout;
export function clampRect(rect: LayoutRect, minWidth?: number, minHeight?: number): LayoutRect;
export function resizeRect(rect: LayoutRect, handle: ResizeHandle, point: NormalizedPoint): LayoutRect;
export function snapRect(rect: LayoutRect, viewport: ViewportSize): LayoutRect;
export function zoneRectFromLayout(rect: LayoutRect): ZoneRect;
export function layoutEquals(left: HudLayout, right: HudLayout): boolean;
export function loadHudLayout(): HudLayout;
export function saveHudLayout(layout: HudLayout): void;
export function clearHudLayout(): void;
```

- [ ] **Step 1: Expand the failing geometry tests**

Add exact behavior tests for: minimum dimensions; right/bottom clamping; each of the four resize handles; free placement outside snap threshold; top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, and bottom-right snapping; layout equality; and conversion of `{ x, y, width, height }` to `{ x0, y0, x1, y1 }`.

Use this snap test fixture so targets are unambiguous:

```ts
const viewport = { width: 1000, height: 800 };
const nearTopCenter = { x: 0.49, y: 0.01, width: 0.2, height: 0.2 };
expect(snapRect(nearTopCenter, viewport)).toMatchObject({ x: 0.4, y: 0 });
```

- [ ] **Step 2: Add failing storage tests**

In `storage.test.ts`, stub `globalThis.localStorage` with an in-memory implementation and test these cases: absent record returns `DEFAULT_HUD_LAYOUT`; save/load returns the entire layout; malformed JSON returns defaults; wrong schema/version returns defaults; non-finite or out-of-bound rectangles return defaults; clear restores defaults on next load.

- [ ] **Step 3: Run tests and confirm they fail for missing modules**

Run: `npm run test -- src/lib/layout/geometry.test.ts src/lib/layout/storage.test.ts`

Expected: FAIL because the layout modules do not exist.

- [ ] **Step 4: Implement layout types and defaults**

Define a `LAYOUT_STORAGE_KEY` and `LAYOUT_STORAGE_VERSION`. Make defaults reproduce the current non-running CSS: sidebar at the upper-left, timer centered at the top, cube at the upper-right, and zones matching the current `LEFT_ZONE` and `RIGHT_ZONE` geometry.

Use `width`/`height` for the zones and derive `ZoneRect` using:

```ts
export function zoneRectFromLayout(rect: LayoutRect): ZoneRect {
  return { x0: rect.x, y0: rect.y, x1: rect.x + rect.width, y1: rect.y + rect.height };
}
```

- [ ] **Step 5: Implement pure geometry with explicit limits**

Use a shared `MIN_PANEL_SIZE` and `MIN_ZONE_SIZE`, clamp every result to `[0, 1]`, and apply the required minimum according to `LayoutItemId`. Define snap targets in terms of an item’s bounding box and use a pixel threshold converted to normalized coordinates from `ViewportSize`. Only return a target when the nearest candidate is inside that threshold.

- [ ] **Step 6: Implement guarded storage**

`loadHudLayout` must return defaults whenever `window` or `localStorage` is unavailable, JSON parsing fails, the record version differs, a required item is absent, or validation fails. `saveHudLayout` must serialize `{ version, layout }` inside a `try/catch`. `clearHudLayout` must remove the storage key inside a `try/catch`.

- [ ] **Step 7: Run all layout unit tests**

Run: `npm run test -- src/lib/layout/geometry.test.ts src/lib/layout/storage.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the layout domain**

```bash
git add src/lib/layout
git commit -m "feat: add persisted HUD layout domain"
```

## Task 3: Drive vision and its preview from the configurable zones

**Files:**
- Modify: `src/lib/vision/pad.ts`
- Create: `src/lib/vision/pad.test.ts`
- Modify: `src/lib/vision/useHandVision.ts`
- Modify: `src/components/VisionPreview.tsx`

**Interfaces:**
- Consumes: `HudLayout` and `zoneRectFromLayout` from Task 2.
- Produces:

```ts
export function rawZoneState(hands: HandLandmarks[], leftZone: ZoneRect, rightZone: ZoneRect): PadZoneState;
export function useHandVision(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  zones: Pick<HudLayout, "leftZone" | "rightZone">,
): VisionState;
```

- [ ] **Step 1: Write failing dynamic-zone tests**

In `pad.test.ts`, make a fixture hand with at least 12 points in a supplied zone. Verify a hand in a custom left zone sets `right: true`, a hand in a custom right zone sets `left: true`, and the same hand returns false when passed a different zone. This confirms the existing mirrored mapping remains deliberate.

- [ ] **Step 2: Run the pad test to establish failure**

Run: `npm run test -- src/lib/vision/pad.test.ts`

Expected: FAIL because `rawZoneState` currently accepts only `hands`.

- [ ] **Step 3: Implement injected-zone detection**

Change `rawZoneState` to accept `leftZone` and `rightZone` parameters. Keep the existing cross-assignment (`LEFT` zone activates the logical right pad and vice versa) exactly as it is today. In `useHandVision`, accept current zones, store them in a ref updated on render, and pass the latest values in the worker landmark callback without recreating the camera worker on every drag.

- [ ] **Step 4: Render the same injected zones in the camera preview**

Replace imports of static `LEFT_ZONE` and `RIGHT_ZONE` in `VisionPreview` with `leftZone` and `rightZone` props. Keep the present cross-highlight behavior so displayed active states remain aligned with the logical timer pads.

- [ ] **Step 5: Run vision unit tests and static checks**

Run: `npm run test -- src/lib/vision/pad.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit vision integration**

```bash
git add src/lib/vision/pad.ts src/lib/vision/pad.test.ts src/lib/vision/useHandVision.ts src/components/VisionPreview.tsx
git commit -m "feat: make hand detection zones configurable"
```

## Task 4: Implement the reusable layout editor with pointer interactions

**Files:**
- Create: `src/components/Layout/LayoutEditor.tsx`
- Create: `src/components/Layout/LayoutEditor.module.css`
- Create: `src/lib/layout/editorReducer.ts`
- Create: `src/lib/layout/editorReducer.test.ts`

**Interfaces:**
- Consumes: `HudLayout`, `LayoutItemId`, `clampRect`, `resizeRect`, `snapRect`, `layoutEquals`, `saveHudLayout`, and defaults from Task 2.
- Produces:

```ts
type LayoutEditorProps = {
  layout: HudLayout;
  onLayoutChange: (layout: HudLayout) => void;
  disabled: boolean;
  children: (itemStyle: (id: "sidebar" | "timer" | "cube") => React.CSSProperties) => React.ReactNode;
};
export function LayoutEditor(props: LayoutEditorProps): React.ReactNode;
```

- [ ] **Step 1: Write failing reducer tests for edit interactions**

Define a pure reducer that receives an interaction start, normalized pointer movement, end, reset, and edit-mode toggle. Test: entering edit mode when enabled; no-op entry while disabled; panel drag updates only the selected item; resize modifies the correct handle; snap applies within threshold; free placement remains unsnapped; ending interaction marks layout for persistence; reset replaces every item with defaults; and `showReset` is false for default layout.

- [ ] **Step 2: Run reducer tests and verify they fail**

Run: `npm run test -- src/lib/layout/editorReducer.test.ts`

Expected: FAIL because `editorReducer.ts` does not exist.

- [ ] **Step 3: Implement the pure editor reducer**

Keep transient fields (`editing`, active item/handle, pointer origin, initial rectangle) separate from `HudLayout`. Convert client pointer positions to normalized coordinates using `window.innerWidth` and `window.innerHeight`. Apply `clampRect` and `snapRect` to each update. Only call `saveHudLayout` from a completed interaction, not on every pointer move.

- [ ] **Step 4: Implement `LayoutEditor` around the reducer**

Render the three panel children at their normalized fixed positions. In edit mode, render an overlay for every item, including the two detection zones; attach `setPointerCapture` on pointer down and release on `pointerup`, `pointercancel`, and `lostpointercapture`. Stop pointer propagation only during edit interactions, so Cube3D retains its existing drag behavior outside edit mode.

Render an accessible floating pencil button with an `aria-label` that switches between “Edit layout” and “Finish editing layout”. When `disabled` is true, do not render the button or editable overlay. Render the Reset button only when `editing && !layoutEquals(layout, DEFAULT_HUD_LAYOUT)`; it must reset all five items and call `clearHudLayout`.

- [ ] **Step 5: Add editor visual affordances**

Use `LayoutEditor.module.css` for high-contrast edit outlines, four corner resize handles, labels for both zones, a snap-highlight class, and the bottom-right pencil/Reset controls. Set `touch-action: none` only on active editor handles/overlays, not on regular panel content.

- [ ] **Step 6: Run editor reducer tests**

Run: `npm run test -- src/lib/layout/editorReducer.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the editor**

```bash
git add src/components/Layout src/lib/layout/editorReducer.ts src/lib/layout/editorReducer.test.ts
git commit -m "feat: add draggable HUD layout editor"
```

## Task 5: Compose custom layout into TimerView and retain focus mode

**Files:**
- Modify: `src/components/TimerView.tsx`
- Modify: `src/components/TimerView.module.css`

**Interfaces:**
- Consumes: `loadHudLayout`, `DEFAULT_HUD_LAYOUT`, `zoneRectFromLayout`, `LayoutEditor`, and the dynamic-zone props introduced in Tasks 2–4.
- Produces: a `TimerView` that restores layout after client mount, persists edit commits, passes both custom zones to vision, and continues to use current focus CSS while `phase === "RUNNING"`.

- [ ] **Step 1: Add a focused integration test before wiring components**

Add a testable pure selector in `src/lib/layout/visibility.ts` and its test. It must assert `canEditLayout("RUNNING") === false` and return `true` for every other `TimerPhase`. It must also assert focus rendering does not mutate the supplied `HudLayout` reference.

- [ ] **Step 2: Run the visibility test and verify failure**

Run: `npm run test -- src/lib/layout/visibility.test.ts`

Expected: FAIL because the selector does not exist.

- [ ] **Step 3: Implement the selector and wire TimerView**

Create `canEditLayout(phase: TimerPhase): boolean` returning `phase !== "RUNNING"`. In `TimerView`, load layout after mount to avoid server/client `localStorage` mismatch, pass current zones into `useHandVision` and `VisionPreview`, and render sidebar/timer/cube through `LayoutEditor`. Keep `focusMode` and the existing class names.

- [ ] **Step 4: Replace only positioning CSS that conflicts with the editor**

Move fixed `top`/`left`/`right` placement for `.sidebar`, `.center`, and `.cubeBox` to editor-provided inline styles. Preserve each panel’s visual styling. Preserve the existing `.focus .center` transform and sidebar/cube opacity rules, but ensure they apply to editor-positioned wrappers. Remove portrait layout overrides that conflict with saved geometry; keep only safe visibility handling such as hidden history/cube where the current product explicitly requires it.

- [ ] **Step 5: Run tests, lint, and production build**

Run: `npm run test && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the composition integration**

```bash
git add src/components/TimerView.tsx src/components/TimerView.module.css src/lib/layout/visibility.ts src/lib/layout/visibility.test.ts
git commit -m "feat: apply persisted layout to timer HUD"
```

## Task 6: Perform end-to-end manual verification and document the result

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: complete feature from Tasks 1–5.
- Produces: concise user-facing instructions for layout editing and verified release readiness.

- [ ] **Step 1: Start the development server**

Run: `npm run dev`

Expected: Next.js reports a ready local URL without compilation errors.

- [ ] **Step 2: Execute the manual acceptance checklist in a browser**

Verify all of the following on desktop and a touch-capable viewport:

1. Pencil is visible outside `RUNNING`, opens edit mode, and closes it.
2. Each of sidebar, timer, cube, left zone, and right zone moves and resizes; nested panel controls remain intact outside edit mode.
3. Each of the eight snap positions engages near its target, while arbitrary positions remain possible.
4. Reload restores the five-item layout exactly.
5. Reset is absent for defaults, appears only after a change while editing, and restores all five items together.
6. Moving either detection zone changes the displayed frame and the effective hand-detection area together, while preserving mirrored pad behavior.
7. Starting the timer hides editor controls and retains the existing focus-mode transition without altering the saved layout.

- [ ] **Step 3: Add a brief README usage note**

Add a “Customize layout” subsection to `README.md` that tells users to press the pencil icon while idle, drag/resize HUD panels or hand zones, use magnetic snap assistance, and use Reset to return to defaults. State that the layout is saved in the browser.

- [ ] **Step 4: Run final automated verification**

Run: `npm run test && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit documentation and verification-ready changes**

```bash
git add README.md
git commit -m "docs: explain HUD layout customization"
```

## Plan Self-Review

- Spec coverage: Tasks 2 and 4 cover normalized storage, validation, drag/resize, eight-point snapping, conditional reset, and free placement. Task 3 connects custom zones to both preview and detection. Task 5 preserves `RUNNING` behavior and blocks editing. Task 6 covers cross-device acceptance and user documentation.
- Placeholder scan: no TODO/TBD language, unspecified test steps, or implied interfaces remain.
- Type consistency: all later tasks use the `HudLayout`, `LayoutRect`, `LayoutItemId`, `zoneRectFromLayout`, and `LayoutEditor` interfaces defined in Tasks 2 and 4.
