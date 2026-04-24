/// <reference lib="webworker" />

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandLandmarks, WorkerRequest, WorkerResponse } from "./types";

// Self-hosted under /public/mediapipe/ — populated by `npm run setup:mediapipe`.
// The WASM fileset ships SIMD + non-SIMD variants; MediaPipe auto-picks SIMD
// when the browser supports it.
const MEDIAPIPE_WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/models/hand_landmarker.task";

let landmarker: HandLandmarker | null = null;

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse): void {
  scope.postMessage(msg);
}

async function init(): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  
  try {
    console.log("[VisionWorker] Attempting to init with GPU...");
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    console.log("[VisionWorker] Landmarker ready (GPU)");
  } catch (err) {
    console.warn("[VisionWorker] GPU initialization failed, falling back to CPU:", err);
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    console.log("[VisionWorker] Landmarker ready (CPU)");
  }
}

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      await init();
      post({ type: "ready" });
      return;
    }
    if (msg.type === "frame") {
      if (!landmarker) {
        msg.bitmap.close();
        return;
      }
      const result = landmarker.detectForVideo(msg.bitmap, msg.timestamp);
      msg.bitmap.close();
      const hands: HandLandmarks[] = result.landmarks.map((hand) =>
        hand.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      );
      post({ type: "landmarks", hands, timestamp: msg.timestamp });
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
