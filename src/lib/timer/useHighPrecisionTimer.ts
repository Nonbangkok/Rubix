"use client";

import { useEffect, useState } from "react";

// Returns elapsed ms since `startedAt`, driven by requestAnimationFrame.
// Re-renders only the component that calls this hook — keep it leaf-level.
export function useHighPrecisionTimer(
  active: boolean,
  startedAt: number | null,
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || startedAt === null) return;
    let raf: number | null = null;
    const tick = () => {
      setElapsed(performance.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [active, startedAt]);

  return active && startedAt !== null ? elapsed : 0;
}
