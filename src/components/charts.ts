/** Helpers shared by the charts. */

export function niceDomain(min: number, max: number, target = 4): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  if (max === min) { max += 1; min -= 1; }
  const raw = (max - min) / target;
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * 10 ** exp;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

export function dayTicks(day: number): number[] {
  const t = [1, 15, 30, 45, 60, 75, 90].filter((x) => x < day - 4);
  t.push(day);
  return t;
}

export const tickFmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));
