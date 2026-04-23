"use client";

import { type RefObject, useEffect, useRef } from "react";
import { zoneToPixels } from "@/lib/vision/pad";
import { LEFT_ZONE, RIGHT_ZONE, type ZoneRect } from "@/lib/vision/types";
import type { VisionState } from "@/lib/vision/useHandVision";

type Props = {
  state: VisionState;
  videoRef: RefObject<HTMLVideoElement | null>;
  className?: string;
};

export function VisionPreview({ state, videoRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const drawCyberZone = (zone: ZoneRect, active: boolean) => {
      const pz = zoneToPixels(zone, w, h);
      const color = active ? "#22ffaa" : "rgba(255, 80, 120, 0.4)";
      const cornerLen = Math.min(pz.w, pz.h) * 0.18;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.lineCap = "round";
      ctx.shadowColor = active ? "#22ffaa" : "rgba(255, 80, 120, 0.6)";
      ctx.shadowBlur = active ? 26 : 6;

      const x1 = pz.x;
      const y1 = pz.y;
      const x2 = pz.x + pz.w;
      const y2 = pz.y + pz.h;
      const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx * cornerLen, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * cornerLen);
        ctx.stroke();
      };
      drawCorner(x1, y1, 1, 1);
      drawCorner(x2, y1, -1, 1);
      drawCorner(x1, y2, 1, -1);
      drawCorner(x2, y2, -1, -1);

      if (active) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(34, 255, 170, 0.05)";
        ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
      }
      ctx.restore();
    };
    drawCyberZone(LEFT_ZONE, state.smoothedZones.left);
    drawCyberZone(RIGHT_ZONE, state.smoothedZones.right);

    ctx.save();
    ctx.fillStyle = "rgba(0, 229, 255, 0.9)";
    ctx.shadowColor = "rgba(0, 229, 255, 0.75)";
    ctx.shadowBlur = 8;
    for (const hand of state.hands) {
      for (const p of hand) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, [state, videoRef]);

  const statusLabel = state.error
    ? `camera error`
    : !state.ready
      ? "loading vision…"
      : "● LIVE";

  return (
    <div className={`pointer-events-none ${className ?? ""}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
      />
    </div>
  );
}
