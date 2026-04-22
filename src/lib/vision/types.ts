export type NormalizedPoint = { x: number; y: number; z: number };

export type HandLandmarks = NormalizedPoint[];

export type ZoneRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PadZoneState = {
  left: boolean;
  right: boolean;
};

export const PAD_LANDMARK_INDICES = [0, 5, 17] as const;

export const LEFT_ZONE: ZoneRect = { x0: 0.05, y0: 0.7, x1: 0.4, y1: 1.0 };
export const RIGHT_ZONE: ZoneRect = { x0: 0.6, y0: 0.7, x1: 0.95, y1: 1.0 };

export type WorkerRequest =
  | { type: "init" }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "landmarks"; hands: HandLandmarks[]; timestamp: number };
