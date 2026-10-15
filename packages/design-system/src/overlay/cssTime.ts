/** Milliseconds for a CSS time such as `300ms` or `0.3s`, or null for anything else. */
export function cssTimeMs(value: string): number | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)(ms|s)$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}
