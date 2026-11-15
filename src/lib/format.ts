/**
 * Format like Python's f"{x:.Nf}": correct rounding of the exact binary value, and
 * round-half-to-even on exact ties (JavaScript's toFixed rounds ties up instead).
 */
export function pyFixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return String(x);
  const exact = x.toFixed(Math.min(100, digits + 60));
  const dot = exact.indexOf('.');
  const head = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  const tail = exact.slice(dot + 1 + digits);
  if (/^50*$/.test(tail)) {
    const lastDigit = Number(head.replace(/[-.]/g, '').slice(-1));
    if (lastDigit % 2 === 0) return head;
    const step = 10 ** -digits;
    const away = Number(head) + (x < 0 ? -step : step);
    return away.toFixed(digits);
  }
  return x.toFixed(digits);
}

/** Like Python's f"{x:+.Nf}". */
export function pySigned(x: number, digits: number): string {
  const s = pyFixed(x, digits);
  return s.startsWith('-') ? s : `+${s}`;
}
