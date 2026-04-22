export function pb(solves: readonly number[]): number | null {
  return solves.length ? Math.min(...solves) : null;
}

// WCA average: take last N, drop best and worst, mean the rest.
export function averageOfN(
  solves: readonly number[],
  n: number,
): number | null {
  if (solves.length < n) return null;
  const sorted = solves.slice(-n).slice().sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((s, x) => s + x, 0);
  return sum / trimmed.length;
}

export const ao5 = (solves: readonly number[]): number | null =>
  averageOfN(solves, 5);

export const ao12 = (solves: readonly number[]): number | null =>
  averageOfN(solves, 12);

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = ms / 1000;
  const whole = Math.floor(totalSec);
  const frac = Math.floor((ms - whole * 1000)).toString().padStart(3, "0");
  if (whole >= 60) {
    const m = Math.floor(whole / 60);
    const s = (whole % 60).toString().padStart(2, "0");
    return `${m}:${s}.${frac}`;
  }
  return `${whole}.${frac}`;
}
