"use client";

import { useEffect, useState, useRef } from "react";
import { rawZoneState, ZoneSmoother } from "./pad";
import type {
  HandLandmarks,
  PadZoneState,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export type VisionState = {
  ready: boolean;
  started: boolean; // True only when the first frame has been processed
  error: string | null;
  hands: HandLandmarks[];
  rawZones: PadZoneState;
  smoothedZones: PadZoneState;
};

const INITIAL_STATE: VisionState = {
  ready: false,
  started: false,
  error: null,
  hands: [],
  rawZones: { left: false, right: false },
  smoothedZones: { left: false, right: false },
};

export function useHandVision(
  videoRef: React.RefObject<HTMLVideoElement | null>,
): VisionState {
  const [state, setState] = useState<VisionState>(INITIAL_STATE);
  
  // Internal refs to avoid stale closures in setInterval/requestAnimationFrame
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const worker = new Worker(new URL("./hand.worker.ts", import.meta.url), {
      type: "module",
    });
    const smoother = new ZoneSmoother();
    let raf: number | null = null;
    let inflight = false;
    let stream: MediaStream | null = null;

    let lastHeartbeat = performance.now();
    
    // Watchdog: If no landmarks received for 5s while video is active, restart.
    const watchdogInterval = setInterval(() => {
      if (cancelledRef.current || !readyRef.current || document.visibilityState === "hidden") return;
      
      const elapsed = performance.now() - lastHeartbeat;
      if (elapsed > 5000) {
        console.warn("[Vision] Watchdog: No data for 5s. Engine might be stuck.");
        // We could force a reload or re-init here if needed
      }
    }, 2000);

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      lastHeartbeat = performance.now(); 

      if (msg.type === "ready") {
        console.log("[Vision] Worker reported READY");
        readyRef.current = true;
        setState((s) => ({ ...s, ready: true, error: null }));
      } else if (msg.type === "error") {
        console.error("[Vision] Worker error:", msg.message);
        setState((s) => ({ ...s, error: msg.message }));
      } else if (msg.type === "landmarks") {
        inflight = false;
        if (!startedRef.current) {
          console.log("[Vision] First landmarks received! Engine started.");
          startedRef.current = true;
        }
        
        const raw = rawZoneState(msg.hands);
        const smoothed = smoother.step(raw);
        setState((s) => ({
          ...s,
          started: true,
          hands: msg.hands,
          rawZones: raw,
          smoothedZones: smoothed,
        }));
      }
    };

    const initMsg: WorkerRequest = { type: "init" };
    worker.postMessage(initMsg);

    const acquireStream = async (): Promise<void> => {
      if (stream || cancelledRef.current) return;
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (cancelledRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      const video = videoRef.current;
      if (video) {
        video.srcObject = s;
        try {
          await video.play();
        } catch {
          // autoplay blocked — ignore; next tick will still run, user can retry.
        }
      }
    };

    const releaseStream = (): void => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };

    const tick = () => {
      if (cancelledRef.current) return;
      const video = videoRef.current;
      
      // Only send frames if worker is ready
      if (
        readyRef.current &&
        stream &&
        video &&
        video.readyState >= 2 &&
        !inflight &&
        document.visibilityState !== "hidden"
      ) {
        inflight = true;
        createImageBitmap(video)
          .then((bitmap) => {
            if (cancelledRef.current) {
              bitmap.close();
              return;
            }
            const frame: WorkerRequest = {
              type: "frame",
              bitmap,
              timestamp: performance.now(),
            };
            worker.postMessage(frame, [bitmap]);
          })
          .catch((err) => {
            console.warn("[Vision] Tick: createImageBitmap failed", err);
            inflight = false;
          });
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseStream();
      } else {
        acquireStream().catch((err) =>
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : String(err),
          })),
        );
      }
    };

    (async () => {
      try {
        await acquireStream();
        tick();
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelledRef.current = true;
      if (raf !== null) cancelAnimationFrame(raf);
      clearInterval(watchdogInterval);
      worker.terminate();
      releaseStream();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [videoRef]);

  return state;
}
