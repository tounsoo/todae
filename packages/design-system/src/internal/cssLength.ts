/** A computed length in pixels, with a percentage of `basis`, or 0 for `auto`, `calc()` and the like. */
export function pixels(value: string, basis: number): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith('%') ? (n * basis) / 100 : n;
}
