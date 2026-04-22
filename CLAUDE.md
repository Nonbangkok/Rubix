# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read [AGENTS.md](AGENTS.md) first** — it warns that this Next.js version (**16.2.4**) has breaking changes from what's in your training data. Before editing anything framework-adjacent, consult `node_modules/next/dist/docs/` for current APIs.

## Commands

- `npm run dev` — dev server on http://localhost:3000 (stable webpack, not Turbopack)
- `npm run build` — production build (uses Turbopack by default in Next 16)
- `npm run lint` — ESLint 9 flat config (`eslint.config.mjs`)
- `npm run start` — serve the production build
- `npm run setup:mediapipe` — copy MediaPipe WASM from `node_modules/@mediapipe/tasks-vision/wasm/` to `public/mediapipe/wasm/` and download `hand_landmarker.task` (~8MB) to `public/mediapipe/models/`. Idempotent — re-run safely. **Required on fresh clones.**
- No test runner is configured yet. When tests are added, run a single test via whatever runner is chosen (TBD — Vitest is the likely fit for Vite-style fast feedback on timer/vision logic).

## Stack

- **Next.js 16.2.4** with App Router, `src/` directory, `@/*` import alias
- **React 19.2.4** (Server Components enabled by default)
- **TypeScript 5** strict mode
- **Tailwind CSS v4** (CSS-first config via `@theme` in [globals.css](src/app/globals.css), no `tailwind.config.js`)
- **Fonts:** Orbitron (timer digits, `--font-orbitron` / Tailwind `--font-display`) + Inter (UI, `--font-inter` / `--font-sans`) — wired via `next/font/google` in [layout.tsx](src/app/layout.tsx)
- **Vision:** `@mediapipe/tasks-vision` (installed, not yet wired)
- **State:** `zustand` (installed, not yet wired)
- **Persistence:** `dexie` for IndexedDB (installed, not yet wired)

## Project Status

Phases 1–5 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) are complete at build/lint level. E2E (camera + real solves + mobile rotation + tab-switch resume) requires browser verification.

**Phase 2 (vision pipeline):**
- [src/lib/vision/types.ts](src/lib/vision/types.ts) — types + zone constants
- [src/lib/vision/pad.ts](src/lib/vision/pad.ts) — pure: `isHandOnPad`, `rawZoneState`, `ZoneSmoother` (3-frame), coord helpers
- [src/lib/vision/hand.worker.ts](src/lib/vision/hand.worker.ts) — module worker running MediaPipe `HandLandmarker` (VIDEO mode, GPU delegate, 2 hands)
- [src/lib/vision/useHandVision.ts](src/lib/vision/useHandVision.ts) — hook: `getUserMedia` + RAF + inflight gating
- [src/components/VisionPreview.tsx](src/components/VisionPreview.tsx) — presentational: mirrored video + overlay canvas (receives state + ref as props)

**Phase 3 (timer):**
- [src/lib/timer/store.ts](src/lib/timer/store.ts) — Zustand store owning the state machine. Phases: `IDLE` → `ARMING` → `READY` → `RUNNING` → `FINISHED` → `IDLE`. 500ms arm via module-scoped `setTimeout` (canceled on phase exit). Solves appended on `RUNNING`→`FINISHED`.
- [src/lib/timer/stats.ts](src/lib/timer/stats.ts) — pure `pb`, `ao5`, `ao12` (WCA: sort last N, drop min/max, mean), `formatMs` (SS.mmm or M:SS.mmm)
- [src/lib/timer/useHighPrecisionTimer.ts](src/lib/timer/useHighPrecisionTimer.ts) — RAF-driven elapsed; first tick deferred via `requestAnimationFrame` to avoid sync setState-in-effect lint error. Returns `0` when inactive.
- [src/lib/timer/useTimerDriver.ts](src/lib/timer/useTimerDriver.ts) — bridges vision + keyboard + sounds into the store. Spacebar-down = both hands on, Spacebar-up = both off. Fires `/sounds/ready.mp3` on entering `READY`, `/sounds/stop.mp3` on `RUNNING`→`FINISHED`; swallows missing-file / autoplay-blocked errors.
- [src/components/Timer/Digits.tsx](src/components/Timer/Digits.tsx) + [.module.css](src/components/Timer/Digits.module.css) — split seconds/ms; per-phase glow via CSS variables.
- [src/components/Timer/Stats.tsx](src/components/Timer/Stats.tsx) — PB / Ao5 / Ao12 / solve count / clear button.
- [src/components/TimerView.tsx](src/components/TimerView.tsx) — composition: `useHandVision` + `useTimerDriver` + all UI pieces.

**Phase 4 (aesthetics):**
- [src/components/Timer/TimerScreen.tsx](src/components/Timer/TimerScreen.tsx) + [.module.css](src/components/Timer/TimerScreen.module.css) — LCD-style bezel wrapper around indicators + digits. Phase-tinted outer glow (box-shadow colored by `--screen-glow` set per `.idle/.arming/...` class); SVG fractalNoise grain overlay via `::before`; faint scanlines via `::after`. Child stacking managed via `.screen > *` z-index=2 so grain + scanlines sit below content.
- [src/components/Timer/HandIndicators.tsx](src/components/Timer/HandIndicators.tsx) + [.module.css](src/components/Timer/HandIndicators.module.css) — **replaced `StatusLights`**. Per-hand LEDs (L/R labels). Variant selected by `(onPad, phase)`: off when hand not in zone; `neutral`/`red`/`green`/`white`/`yellow` based on phase when on pad. Each variant = inner shadow + layered outer glows matching the digit tint.
- Digit glow upgraded to 4 layers (4/12/28/64px) for a more diffuse "LED burning through smoke" feel.
- **Removed**: `src/components/Timer/StatusLights.{tsx,module.css}`.

**Phase 5 (mobile + perf):**
- [scripts/setup-mediapipe.mjs](scripts/setup-mediapipe.mjs) — idempotent setup: copies WASM (SIMD + non-SIMD variants) from `node_modules/@mediapipe/tasks-vision/wasm/` into `public/mediapipe/wasm/`, then downloads `hand_landmarker.task` (float16, ~7.8MB) into `public/mediapipe/models/`. Runs via `npm run setup:mediapipe`. Browser auto-selects SIMD when supported → faster inference on modern mobiles.
- [src/lib/vision/hand.worker.ts](src/lib/vision/hand.worker.ts) now points at local paths (`/mediapipe/wasm`, `/mediapipe/models/hand_landmarker.task`) — no runtime CDN dependency. Preserves the privacy invariant (zero network calls in the vision path after initial load).
- [src/lib/vision/useHandVision.ts](src/lib/vision/useHandVision.ts) — stream lifecycle split into `acquireStream` / `releaseStream` + `visibilitychange` listener. Hidden tab → `releaseStream()` stops all video tracks and clears `video.srcObject`. Visible again → `acquireStream()` re-requests `getUserMedia`. Worker stays up across cycles (cheap to keep, expensive to re-init MediaPipe).
- [src/components/PortraitPrompt.tsx](src/components/PortraitPrompt.tsx) + [.module.css](src/components/PortraitPrompt.module.css) — CSS-only overlay. `@media (max-width: 900px) and (orientation: portrait)` flips `display` to flex. Rocking rotate icon (`⟳`, -12°↔78° animation). No JS orientation listener needed — rotation auto-hides it.
- [eslint.config.mjs](eslint.config.mjs) — adds `public/mediapipe/**` to `globalIgnores` (MediaPipe's generated WASM glue JS produced 714 lint warnings otherwise).

**Spacebar fallback** is always active, not camera-conditional (the plan calls it a "fallback" but there's no harm in both inputs driving the same reducer — the state machine is idempotent on same-value pad signals).

**Deferred:**
- **Solve history persistence** — stats are **session-only** (in-memory Zustand `solves: number[]`). Future: persist to IndexedDB via Dexie.
- **Audio assets** — `public/sounds/` still empty unless user has dropped `ready.mp3` / `stop.mp3`. Missing files are handled gracefully (silent); drop them in and the cues just start working on next reload.
- **Zone Visualizer debug toggle** — the overlay is always on. Add a toggle in a settings panel later.

## What This App Is

"Rubix" is a webcam-based Rubik's Cube speedsolve timer that emulates a **Stackmat Pro Timer G5**. All vision processing runs on-device — no frames ever leave the browser. The "tactile feel" of a physical Stackmat is reproduced via a state machine + red/green light feedback driven by hand-in-zone detection.

## Architecture (from the plan — read before editing)

The design has four tightly coupled subsystems. Changes in one usually require understanding the others:

1. **Vision pipeline** (`src/lib/vision`) — MediaPipe Tasks Vision runs in a **Web Worker** so AI inference never blocks the UI/RAF loop. WASM + the `.task` model are self-hosted under `/public/mediapipe/` (populated via `npm run setup:mediapipe`) to uphold the on-device privacy invariant.

2. **"Virtual Pad" hand processor** — Normalized coordinate space (0.0–1.0). Two pad zones at the bottom of the frame:
   - Left: `x[0.05–0.40], y[0.70–1.00]`
   - Right: `x[0.60–0.95], y[0.70–1.00]`

   A hand counts as "on pad" when **> 2 of landmarks {0 (wrist), 5 (index MCP), 17 (pinky MCP)}** fall inside the zone. State must be consistent for **≥ 3 frames** (temporal smoothing) before it's accepted — this is load-bearing for preventing false stops from motion blur. Don't remove it.

3. **Timer state machine** — Drives UI, sound, and timing. Transitions:
   - `IDLE` → `ARMING` when both hands enter zones (show red, start 500ms countdown)
   - `ARMING` → `IDLE` if any hand leaves (cancel)
   - `ARMING` → `READY` after holding 500ms (show green)
   - `READY` → `RUNNING` when any hand leaves — record `performance.now()`
   - `RUNNING` → `FINISHED` when both hands re-enter — record endTime
   - `FINISHED` → `IDLE` on next hand leave+re-enter

   Timing MUST use `performance.now()`, never `Date.now()`. Display updates drive off `requestAnimationFrame` via a `useHighPrecisionTimer` hook.

4. **State & persistence** — `Zustand` for in-memory timer state (chosen specifically so 60fps timer updates don't re-render unrelated components — keep slices narrow). Solve history persists to **IndexedDB via Dexie.js**, not localStorage. `localStorage` is only for lightweight UI prefs / PB+Ao5+Ao12 caches per the plan.

## Non-obvious Constraints

- **Strict TypeScript** — hand-landmark coordinate structures are easy to mis-shape; don't relax `strict` to silence MediaPipe typing issues, narrow instead.
- **CSS Modules + CSS Variables** (not Tailwind utility classes) are the chosen path for the timer's glow/LED animations and Red/Green/Gray status transitions. Tailwind is present for layout/scaffolding but the timer component's aesthetics live in CSS Modules.
- **Mobile:** apply `touch-action: none` on the timer surface to kill scroll/zoom during solves; prompt to rotate in portrait via Device Orientation API.
- **PC fallback:** Spacebar must act as a timer input when no camera is available — the state machine should be driven by an abstract "hands in zone" signal that either vision or keyboard can satisfy.
- **Power management:** stop the camera + worker on `visibilitychange` (tab hidden) to avoid draining battery.
- **Privacy invariant:** no frame, no landmark stream, no image data may be sent off-device. Anything that adds a network call in the vision path is a regression.
