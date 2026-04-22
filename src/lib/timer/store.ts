"use client";

import { create } from "zustand";

export type TimerPhase =
  | "IDLE"
  | "ARMING"
  | "READY"
  | "RUNNING"
  | "FINISHED";

export const ARM_THRESHOLD_MS = 500;

type State = {
  phase: TimerPhase;
  armStartedAt: number | null;
  runStartedAt: number | null;
  runFinishedAt: number | null;
  solves: number[];
};

type Actions = {
  handlePad: (left: boolean, right: boolean, now: number) => void;
  clearHistory: () => void;
};

const INITIAL: State = {
  phase: "IDLE",
  armStartedAt: null,
  runStartedAt: null,
  runFinishedAt: null,
  solves: [],
};

let armTimer: ReturnType<typeof setTimeout> | null = null;

function clearArmTimer(): void {
  if (armTimer !== null) {
    clearTimeout(armTimer);
    armTimer = null;
  }
}

export const useTimerStore = create<State & Actions>()((set, get) => ({
  ...INITIAL,

  handlePad: (left, right, now) => {
    const bothOn = left && right;
    const bothOff = !left && !right;
    const { phase, runStartedAt } = get();

    switch (phase) {
      case "IDLE":
        if (bothOn) {
          clearArmTimer();
          set({ phase: "ARMING", armStartedAt: now });
          armTimer = setTimeout(() => {
            armTimer = null;
            if (get().phase === "ARMING") set({ phase: "READY" });
          }, ARM_THRESHOLD_MS);
        }
        break;

      case "ARMING":
        if (!bothOn) {
          clearArmTimer();
          set({ phase: "IDLE", armStartedAt: null });
        }
        break;

      case "READY":
        if (!bothOn) {
          set({ phase: "RUNNING", runStartedAt: now });
        }
        break;

      case "RUNNING":
        if (bothOn && runStartedAt !== null) {
          const solveMs = now - runStartedAt;
          set((s) => ({
            phase: "FINISHED",
            runFinishedAt: now,
            solves: [...s.solves, solveMs],
          }));
        }
        break;

      case "FINISHED":
        if (bothOff) {
          set({
            phase: "IDLE",
            armStartedAt: null,
            runStartedAt: null,
            runFinishedAt: null,
          });
        }
        break;
    }
  },

  clearHistory: () => {
    clearArmTimer();
    set({ ...INITIAL });
  },
}));
