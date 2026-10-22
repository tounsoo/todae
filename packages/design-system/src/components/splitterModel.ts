// The pure rules of Splitter: sizes, collapse and keys. No React, no DOM.

export type SplitterOrientation = 'horizontal' | 'vertical';
export type SplitterPrimary = 'start' | 'end';

/** What a key does to the primary panel's size. */
export type SplitterKeyAction = 'grow' | 'shrink' | 'min' | 'max' | 'toggle';

/** The sizes the primary panel may take, in pixels. `max` is already limited by the container. */
export type Bounds = { min: number; max: number; collapsible: boolean };

/** The size a splitter starts at when neither `value` nor `defaultValue` is given, before `min` and `max` apply. */
export const DEFAULT_SIZE = 240;

/** The largest size the bounds allow: `max`, but never below `min`. */
function ceiling({ min, max }: Bounds): number {
  return Math.max(min, max);
}

/** The smallest size the bounds allow: 0 when collapsible, else `min`. */
export function floorSize(bounds: Bounds): number {
  return bounds.collapsible ? 0 : bounds.min;
}

/** The largest size the bounds allow. */
export function ceilingSize(bounds: Bounds): number {
  return ceiling(bounds);
}

/**
 * Pulls `size` into the bounds. A collapsible panel keeps 0, a size below
 * `min` otherwise rises to it, and one past `max` falls to it. A size that is
 * not a number reads as the smallest.
 */
export function clampSize(size: number, bounds: Bounds): number {
  if (Number.isNaN(size)) return floorSize(bounds);
  if (bounds.collapsible && size <= 0) return 0;
  return Math.min(Math.max(size, bounds.min), ceiling(bounds));
}

/**
 * {@link clampSize} for a size that follows a pointer: a collapsible panel
 * dragged below half of `min` snaps to 0, and between that and `min` holds at `min`.
 */
export function snapSize(size: number, bounds: Bounds): number {
  if (bounds.collapsible && size < bounds.min / 2) return 0;
  return clampSize(size, bounds);
}

/**
 * The size after one arrow key moves the handle toward (`shrink`) or away
 * from (`grow`) the primary panel. A collapsible panel leaves 0 for `min` and
 * goes to 0 from `min`, instead of stepping through sizes it may not take.
 */
export function stepSize(direction: 'grow' | 'shrink', size: number, bounds: Bounds, step: number): number {
  if (direction === 'grow') {
    return clampSize(bounds.collapsible && size < bounds.min ? bounds.min : size + step, bounds);
  }
  const next = size - step;
  return bounds.collapsible && next < bounds.min ? 0 : clampSize(next, bounds);
}

/**
 * The size Enter gives: 0 for an open panel, and for a collapsed one the size
 * it had before, or `min` (at least `step`) when it never had one.
 */
export function toggledSize(size: number, restore: number, bounds: Bounds, step: number): number {
  if (size > 0) return 0;
  const target = restore > 0 ? restore : Math.max(bounds.min, step);
  return Math.min(Math.max(target, bounds.min), ceiling(bounds));
}

/**
 * What a key does, by physical direction, as the ARIA window splitter says: an
 * arrow moves the handle that way. Moving it toward the primary panel
 * shrinks the panel, so which arrow grows it depends on which side the panel
 * is on, and in a horizontal layout on the text direction (`rtl`).
 * `orientation` is the axis the panels lie along. `null` for any other key.
 */
export function keyAction(
  key: string,
  orientation: SplitterOrientation,
  primary: SplitterPrimary,
  rtl: boolean,
): SplitterKeyAction | null {
  switch (key) {
    case 'Home':
      return 'min';
    case 'End':
      return 'max';
    case 'Enter':
      return 'toggle';
  }
  if (orientation === 'horizontal') {
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
    // The primary panel is on the left in left-to-right text when it is first, and in right-to-left when it is last.
    const primaryOnLeft = (primary === 'start') !== rtl;
    return (key === 'ArrowRight') === primaryOnLeft ? 'grow' : 'shrink';
  }
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return null;
  return (key === 'ArrowDown') === (primary === 'start') ? 'grow' : 'shrink';
}

/**
 * The primary panel's size for a pointer at `pointer` along the axis, given
 * the panel's outer edge `origin`, `sign` (1 when sizes grow toward larger
 * coordinates, -1 when toward smaller) and `offset`, how far into the handle the press
 * landed from its near edge, which keeps the handle from jumping.
 */
export function pointerSize(pointer: number, origin: number, sign: 1 | -1, offset: number): number {
  return sign * (pointer - origin) - offset;
}
