/** A computed length in pixels, with a percentage of `basis`, or 0 for `auto`, `calc()` and the like. */
export function pixels(value: string, basis: number): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith('%') ? (n * basis) / 100 : n;
}

/**
 * How much a box is drawn larger or smaller than its layout, as under a transform, from a size on screen
 * and the same size in layout. A gap of a pixel or less is the layout size's rounding, not a scale.
 */
export function layoutScale(drawn: number, laid: number): number {
  return laid > 0 && Math.abs(drawn - laid) > 1 ? drawn / laid : 1;
}
