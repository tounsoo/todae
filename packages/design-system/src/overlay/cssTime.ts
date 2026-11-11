/** Milliseconds for a CSS time such as `300ms` or `0.3s`, or null for anything else. */
export function cssTimeMs(value: string): number | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)(ms|s)$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

/** A duration token's milliseconds as `node` computes it, or null when it has none. */
export function tokenMs(node: Element | null, name: string): number | null {
  if (!node) return null;
  const ms = cssTimeMs(getComputedStyle(node).getPropertyValue(name));
  return ms === null ? null : Math.max(0, ms);
}
