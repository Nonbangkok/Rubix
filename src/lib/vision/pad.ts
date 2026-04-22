import {
  LEFT_ZONE,
  PAD_LANDMARK_INDICES,
  RIGHT_ZONE,
  type HandLandmarks,
  type NormalizedPoint,
  type PadZoneState,
  type ZoneRect,
} from "./types";

export function pointInZone(p: NormalizedPoint, zone: ZoneRect): boolean {
  return p.x >= zone.x0 && p.x <= zone.x1 && p.y >= zone.y0 && p.y <= zone.y1;
}

// Pro-logic: Check density of landmarks in the zone and depth (Z).
// Much more stable than checking specific indices.
const DENSITY_THRESHOLD = 6; // At least 6 of 21 points must be in zone
const MAX_DEPTH = 0.15;      // Ignore hands too far from camera

export function isHandOnPad(hand: HandLandmarks, zone: ZoneRect): boolean {
  let pointsInZone = 0;
  
  for (const p of hand) {
    // MediaPipe Z is relative, but we can use it to filter background noise
    if (p.z > MAX_DEPTH) continue; 
    
    if (pointInZone(p, zone)) {
      pointsInZone++;
    }
  }

  return pointsInZone >= DENSITY_THRESHOLD;
}

export function rawZoneState(hands: HandLandmarks[]): PadZoneState {
  let left = false;
  let right = false;
  for (const hand of hands) {
    if (!left && isHandOnPad(hand, LEFT_ZONE)) left = true;
    if (!right && isHandOnPad(hand, RIGHT_ZONE)) right = true;
    if (left && right) break;
  }
  return { left, right };
}

// State must be consistent for >= 3 frames before it's emitted. See CLAUDE.md.
export class ZoneSmoother {
  private static readonly REQUIRED_FRAMES = 2;
  private leftCandidate = false;
  private rightCandidate = false;
  private leftStreak = 0;
  private rightStreak = 0;
  private leftEmitted = false;
  private rightEmitted = false;

  step(raw: PadZoneState): PadZoneState {
    if (raw.left === this.leftCandidate) {
      this.leftStreak++;
    } else {
      this.leftCandidate = raw.left;
      this.leftStreak = 1;
    }
    if (this.leftStreak >= ZoneSmoother.REQUIRED_FRAMES) {
      this.leftEmitted = this.leftCandidate;
    }

    if (raw.right === this.rightCandidate) {
      this.rightStreak++;
    } else {
      this.rightCandidate = raw.right;
      this.rightStreak = 1;
    }
    if (this.rightStreak >= ZoneSmoother.REQUIRED_FRAMES) {
      this.rightEmitted = this.rightCandidate;
    }

    return { left: this.leftEmitted, right: this.rightEmitted };
  }

  reset(): void {
    this.leftCandidate = false;
    this.rightCandidate = false;
    this.leftStreak = 0;
    this.rightStreak = 0;
    this.leftEmitted = false;
    this.rightEmitted = false;
  }
}

export function toPixels(
  p: NormalizedPoint,
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: p.x * width, y: p.y * height };
}

export function zoneToPixels(
  zone: ZoneRect,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: zone.x0 * width,
    y: zone.y0 * height,
    w: (zone.x1 - zone.x0) * width,
    h: (zone.y1 - zone.y0) * height,
  };
}
