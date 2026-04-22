"use client";

import { useEffect, useState } from "react";
import { rawZoneState, ZoneSmoother } from "./pad";
import type {
  HandLandmarks,
  PadZoneState,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export type VisionState = {
  ready: boolean;
  error: string | null;
  hands: HandLandmarks[];
  rawZones: PadZoneState;
  smoothedZones: PadZoneState;
};

const INITIAL_STATE: VisionState = {
  ready: false,
  error: null,
  hands: [],
  rawZones: { left: false, right: false },
  smoothedZones: { left: false, right: false },
};

export function useHandVision(
  videoRef: React.RefObject<HTMLVideoElement | null>,
): VisionState {
  const [state, setState] = useState<VisionState>(INITIAL_STATE);

  useEffect(() => {
    const worker = new Worker(new URL("./hand.worker.ts", import.meta.url), {
      type: "module",
    });
    const smoother = new ZoneSmoother();
    let raf: number | null = null;
    let inflight = false;
    let cancelled = false;
    let stream: MediaStream | null = null;

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === "ready") {
        setState((s) => ({ ...s, ready: true }));
      } else if (msg.type === "error") {
        setState((s) => ({ ...s, error: msg.message }));
      } else if (msg.type === "landmarks") {
        inflight = false;
        const raw = rawZoneState(msg.hands);
        const smoothed = smoother.step(raw);
        setState((s) => ({
          ...s,
          hands: msg.hands,
          rawZones: raw,
          smoothedZones: smoothed,
        }));
      }
    };

    const initMsg: WorkerRequest = { type: "init" };
    worker.postMessage(initMsg);

    const acquireStream = async (): Promise<void> => {
      if (stream || cancelled) return;
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (cancelled) {
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
      if (cancelled) return;
      const video = videoRef.current;
      if (
        stream &&
        video &&
        video.readyState >= 2 &&
        !inflight &&
        document.visibilityState !== "hidden"
      ) {
        inflight = true;
        createImageBitmap(video)
          .then((bitmap) => {
            if (cancelled) {
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
          .catch(() => {
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
      cancelled = true;
      if (raf !== null) cancelAnimationFrame(raf);
      worker.terminate();
      releaseStream();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [videoRef]);

  return state;
}
