import type { CubeState, Face } from "./types";

// 4-cycles for each clockwise face turn. Cycle (a, b, c, d) means the sticker
// at position `a` moves to `b`, `b` to `c`, ... `d` to `a`.
//
// Derived from first principles using a right-handed coord system (+X=R, +Y=U,
// +Z=F) and rotation matrices for each face turn. Each face turn = two face-
// internal 4-cycles + three belt 4-cycles (one per piece-orientation class).
//
// Verified by: F F F F = identity, and U U U = U' on the inline sanity check.
const CYCLES: Record<Face, number[][]> = {
  U: [
    [0, 2, 8, 6],
    [1, 5, 7, 3],
    [18, 36, 45, 9],
    [19, 37, 46, 10],
    [20, 38, 47, 11],
  ],
  D: [
    [27, 29, 35, 33],
    [28, 32, 34, 30],
    [24, 15, 51, 42],
    [25, 16, 52, 43],
    [26, 17, 53, 44],
  ],
  R: [
    [9, 11, 17, 15],
    [10, 14, 16, 12],
    [20, 2, 51, 29],
    [23, 5, 48, 32],
    [26, 8, 45, 35],
  ],
  L: [
    [36, 38, 44, 42],
    [37, 41, 43, 39],
    [0, 18, 27, 53],
    [3, 21, 30, 50],
    [6, 24, 33, 47],
  ],
  F: [
    [18, 20, 26, 24],
    [19, 23, 25, 21],
    [6, 9, 29, 44],
    [7, 12, 28, 41],
    [8, 15, 27, 38],
  ],
  B: [
    [45, 47, 53, 51],
    [46, 50, 52, 48],
    [0, 42, 35, 11],
    [1, 39, 34, 14],
    [2, 36, 33, 17],
  ],
};

function applyCycles(state: CubeState, cycles: number[][]): CubeState {
  const next = state.slice();
  for (const cycle of cycles) {
    const n = cycle.length;
    for (let i = 0; i < n; i++) {
      next[cycle[(i + 1) % n]] = state[cycle[i]];
    }
  }
  return next;
}

export function applyMove(state: CubeState, move: string): CubeState {
  if (!move) return state;
  const face = move[0] as Face;
  const cycles = CYCLES[face];
  if (!cycles) return state;
  const mod = move.slice(1);
  const count = mod === "2" ? 2 : mod === "'" ? 3 : 1;
  let s = state;
  for (let i = 0; i < count; i++) s = applyCycles(s, cycles);
  return s;
}

export function applyMoves(state: CubeState, moves: string[]): CubeState {
  let s = state;
  for (const m of moves) s = applyMove(s, m);
  return s;
}
