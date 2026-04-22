# Rubix Stackmat Timer (CV Edition) - Comprehensive Implementation Plan

## 🎯 Core Idea & Philosophy
Build a Rubik's Cube timer system that functions like a **Stackmat Timer (Pro Timer G5)** using a webcam as the primary input. The system must provide a "Tactile Feel" similar to physical hardware through visual and sound feedback, focusing on high precision (low latency) and privacy (on-device processing).

---

## 🛠️ Tech Stack & Technical Rationale
*   **Language:** `TypeScript 5.0+` (Strict Mode)
    - *Rationale:* Prevents errors when passing complex hand coordinate data.
*   **Framework:** `Next.js 14 (App Router)`
    - *Rationale:* Used for a scalable project structure and efficient management of static assets (fonts/sounds).
*   **AI Engine:** `@mediapipe/tasks-vision` (Latest Version)
    - *Rationale:* Provides stable 21-point landmarks per hand, even in low-light conditions.
*   **State Management:** `Zustand`
    - *Rationale:* Manages timer state updates in real-time (60fps) without unnecessary re-renders of other components.
*   **Styling:** `CSS Modules` + `CSS Variables`
    - *Rationale:* Precise control over animation performance and status color transitions (Red/Green/Gray).

---

## 🏗️ System Architecture & Deep Logic

### 1. Advanced Hand Processor (The "Virtual Pad")
Simulating pressure sensors using a normalized coordinate system (0.0 - 1.0):
- **Pad Zone Definition:**
    - Defines rectangular bounding boxes on both sides (Left-Right) at the bottom of the frame.
    - `Left Pad: x[0.05 - 0.40], y[0.70 - 1.00]`
    - `Right Pad: x[0.60 - 0.95], y[0.70 - 1.00]`
- **Detection Logic:**
    - The system checks landmarks 0 (Wrist), 5 (Index finger base), and 17 (Pinky base).
    - If > 2 of these points are within the Pad Zone, it is considered a **"Hand on Pad"** state.
- **Noise Filtering:** Uses *Temporal Smoothing* (state must be consistent for at least 3 frames) to prevent accidental timer stops due to motion blur.

### 2. Timer State Machine (Detailed Transitions)
| Current State | Event | Target State | Action |
| :--- | :--- | :--- | :--- |
| **IDLE** | 2 Hands Detected in Zone | **ARMING** | Show red light, start 500ms countdown |
| **ARMING** | 1 or 2 Hands Leave Zone | **IDLE** | Cancel countdown, lights off |
| **ARMING** | Hold for > 500ms | **READY** | Show green light, prepare to start |
| **READY** | Any Hand Leaves Zone | **RUNNING** | Record `performance.now()`, start updating digits |
| **RUNNING** | 2 Hands Re-enter Zone | **FINISHED** | Record `endTime`, calculate result, lights off |
| **FINISHED** | Any Hand Leaves & Re-enters | **IDLE** | Reset digits to 00.000, ready for new round |

---

## 📋 Granular Implementation Steps

### Phase 1: Environment & Tooling
- [ ] Initialize Next.js with `--ts`, `--tailwind`, `--eslint`.
- [ ] Configure `next.config.js` to support WebAssembly (WASM) for MediaPipe.
- [ ] Create asset management system:
    - Font: **Orbitron** for the timer, **Inter** for other UI parts.
    - Sound: `ready.mp3`, `stop.mp3`.

### Phase 2: The Vision Engine (`/lib/vision`)
- [ ] **Worker Implementation:** Run MediaPipe in a Web Worker to prevent AI computations from blocking the UI thread.
- [ ] **Coordinate Normalizer:** Function to map MediaPipe coordinates to actual Canvas size based on the camera's aspect ratio.
- [ ] **Zone Visualizer:** Debug mode for drawing Pad bounding boxes to help users adjust camera distance.

### Phase 3: The Clock Component (`/components/timer`)
- [ ] **High-Frequency Hook:** Create a `useHighPrecisionTimer` custom hook using `requestAnimationFrame`.
- [ ] **Display Logic:** Separate display of seconds (large) and milliseconds (small) for aesthetics.
- [ ] **Inspection UI:** Add buttons to view statistics (PB, Ao5, Ao12) stored in `localStorage`.

### Phase 4: Premium Stackmat Aesthetics
- [ ] **Glow Effect:** Use layered `box-shadow` and `text-shadow` to simulate LED screen glow.
- [ ] **Physical Indicators:** Create hand UI components with states:
    - *Dimmed:* Hand not detected.
    - *Bright Red:* Arming.
    - *Bright Green:* Ready to start.
- [ ] **Screen Texture:** Use a subtle "Grain" texture overlay on the screen for realism.

### Phase 5: Mobile & Performance Tuning
- [ ] **Device Orientation API:** Prompt to rotate screen when in portrait mode.
- [ ] **WASM SIMD:** Enable SIMD optimization in MediaPipe for better FPS on older mobile devices.
- [ ] **Power Management:** Automatically stop camera processing when the user switches tabs or minimizes the window.

---

## 📱 Platform Specific Details
- **PC:** Supports Spacebar as a fallback if the camera is unavailable.
- **Mobile:** Use `touch-action: none` on the timer area to prevent scrolling or zooming during use.

---

## 🔒 Security & Data Integrity
- Solve times will be stored in `IndexedDB` via `Dexie.js` for stability and higher capacity than `localStorage`.
- No images or videos will ever be sent off the user's device.
