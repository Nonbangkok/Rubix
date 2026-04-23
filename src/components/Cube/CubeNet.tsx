"use client";

import { useMemo, useEffect, useState } from "react";
import { scrambledState } from "@/lib/cube/state";
import {
  COLOR_HEX,
  FACE_START,
  type CubeState,
  type Face,
} from "@/lib/cube/types";

// Net layout (cells, where 1 cell = 1 sticker):
//         U (3x3)
//   L (3x3) F (3x3) R (3x3) B (3x3)
//         D (3x3)
const FACE_GRID: Record<Face, [number, number]> = {
  U: [3, 0],
  L: [0, 3],
  F: [3, 3],
  R: [6, 3],
  B: [9, 3],
  D: [3, 6],
};

const CELL = 10; // sticker edge in SVG units
const GAP = 1; // gap between stickers

const W = 12 * (CELL + GAP);
const H = 9 * (CELL + GAP);

function StickerGrid({ face, state }: { face: Face; state: CubeState }) {
  const [gx, gy] = FACE_GRID[face];
  const start = FACE_START[face];
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = (gx + col) * (CELL + GAP);
    const y = (gy + row) * (CELL + GAP);
    cells.push(
      <rect
        key={`${face}-${i}`}
        x={x}
        y={y}
        width={CELL}
        height={CELL}
        rx={1.2}
        fill={COLOR_HEX[state[start + i]]}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.4}
      />,
    );
  }
  return <g>{cells}</g>;
}

export function CubeNet({ scramble }: { scramble: string[] }) {
  const [mounted, setMounted] = useState(false);
  const state = useMemo(() => scrambledState(scramble), [scramble]);
  const faces: Face[] = ["U", "L", "F", "R", "B", "D"];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Scrambled cube net"
    >
      {faces.map((f) => (
        <StickerGrid key={f} face={f} state={state} />
      ))}
    </svg>
  );
}
