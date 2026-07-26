import { describe, expect, it } from "vitest";
import { rawZoneState } from "./pad";
import type { HandLandmarks, ZoneRect } from "./types";

function handInside(zone: ZoneRect): HandLandmarks {
  return Array.from({ length: 21 }, (_, index) => ({
    x: zone.x0 + ((index % 4) + 1) * ((zone.x1 - zone.x0) / 5),
    y: zone.y0 + ((index % 5) + 1) * ((zone.y1 - zone.y0) / 6),
    z: 0.05,
  }));
}

describe("rawZoneState", () => {
  const leftZone = { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.35 };
  const rightZone = { x0: 0.65, y0: 0.45, x1: 0.9, y1: 0.8 };

  it("maps a hand in the custom physical left zone to the mirrored logical right state", () => {
    expect(rawZoneState([handInside(leftZone)], leftZone, rightZone)).toEqual({
      left: false,
      right: true,
    });
  });

  it("maps a hand in the custom physical right zone to the mirrored logical left state", () => {
    expect(rawZoneState([handInside(rightZone)], leftZone, rightZone)).toEqual({
      left: true,
      right: false,
    });
  });

  it("does not activate either state for hands outside the supplied zones", () => {
    const mismatchedZone = { x0: 0.38, y0: 0.05, x1: 0.55, y1: 0.25 };

    expect(rawZoneState([handInside(mismatchedZone)], leftZone, rightZone)).toEqual({
      left: false,
      right: false,
    });
  });
});
