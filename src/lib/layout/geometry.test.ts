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
