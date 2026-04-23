"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { scrambledState } from "@/lib/cube/state";
import {
  COLOR_HEX,
  FACE_START,
  type CubeState,
  type Face,
} from "@/lib/cube/types";
import styles from "./Cube3D.module.css";

// CSS-3D cube: 6 face planes × 9 tiles each. No three.js, no RAF loop — the
// scene only re-renders on drag, so the vision worker's main-thread RAF
// (createImageBitmap + postMessage) stays unimpeded.
//
// Face transforms are the standard CSS cube pattern. The DOM order of the
// 9 tiles within each face matches our index layout (top-left of face =
// index 0 of that face's 9), which is consistent with CubeNet.

const FACE_TRANSFORM: Record<Face, string> = {
  F: "translateZ(var(--half))",
  B: "rotateY(180deg) translateZ(var(--half))",
  R: "rotateY(90deg) translateZ(var(--half))",
  L: "rotateY(-90deg) translateZ(var(--half))",
  U: "rotateX(90deg) translateZ(var(--half))",
  D: "rotateX(-90deg) translateZ(var(--half))",
};

function FacePlane({ face, state }: { face: Face; state: CubeState }) {
  const start = FACE_START[face];
  const tiles = [];
  for (let i = 0; i < 9; i++) {
    tiles.push(
      <div
        key={i}
        className={styles.tile}
        style={{ background: COLOR_HEX[state[start + i]] }}
      />,
    );
  }
  return (
    <div
      className={styles.face}
      style={{ transform: FACE_TRANSFORM[face] }}
      aria-label={`${face} face`}
    >
      {tiles}
    </div>
  );
}

export function Cube3D({ scramble }: { scramble: string[] }) {
  const state = useMemo(() => scrambledState(scramble), [scramble]);
  const [rot, setRot] = useState({ x: -22, y: -32 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const faces: Face[] = ["U", "D", "L", "R", "F", "B"];

  useEffect(() => {
    let frame: number;
    const animate = () => {
      if (!drag.current) {
        setRot((r) => ({ ...r, y: r.y + 0.4 }));
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({ x: clamp(r.x - dy * 0.5, -85, 85), y: r.y + dx * 0.5 }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture was never set (e.g. click without drag) — ignore
    }
  };

  return (
    <div
      className={styles.viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={styles.scene}
        style={{
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        }}
      >
        {faces.map((f) => (
          <FacePlane key={f} face={f} state={state} />
        ))}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
