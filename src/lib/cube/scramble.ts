import type { Face } from "./types";

const FACES: Face[] = ["U", "D", "F", "B", "L", "R"];
const MODIFIERS = ["", "'", "2"] as const;
const AXIS: Record<Face, "x" | "y" | "z"> = {
  U: "y",
  D: "y",
  F: "z",
  B: "z",
  L: "x",
  R: "x",
};

// WCA 3x3 scramble rules:
//   - no two consecutive moves on the same face
//   - no three consecutive moves on the same axis (e.g. R L R disallowed;
//     R L U is fine)
export function generateScramble(length = 20): string[] {
  const moves: string[] = [];
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * 6)];
    const last = moves[moves.length - 1]?.[0] as Face | undefined;
    const prev = moves[moves.length - 2]?.[0] as Face | undefined;
    if (last && face === last) continue;
    if (
      last &&
      prev &&
      AXIS[face] === AXIS[last] &&
      AXIS[face] === AXIS[prev]
    ) {
      continue;
    }
    const mod = MODIFIERS[Math.floor(Math.random() * 3)];
    moves.push(`${face}${mod}`);
  }
  return moves;
}
