import { applyMoves } from "./moves";
import { type Color, type CubeState, type Face, FACE_COLOR } from "./types";

export function solvedState(): CubeState {
  const s: Color[] = new Array(54);
  const faces: Face[] = ["U", "R", "F", "D", "L", "B"];
  faces.forEach((f, fi) => {
    const color = FACE_COLOR[f];
    for (let i = 0; i < 9; i++) s[fi * 9 + i] = color;
  });
  return s;
}

export function scrambledState(scramble: string[]): CubeState {
  return applyMoves(solvedState(), scramble);
}
