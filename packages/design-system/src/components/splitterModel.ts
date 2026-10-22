// The pure rules of Splitter: sizes, collapse and keys. No React, no DOM.

export type SplitterOrientation = 'horizontal' | 'vertical';
export type SplitterPrimary = 'start' | 'end';

/** What a key does to the primary panel's size. */
export type SplitterKeyAction = 'grow' | 'shrink' | 'min' | 'max' | 'toggle';

/** The sizes the primary panel may take, in pixels. `max` is already limited by the container, and may be infinite before it is measured. */
export type Bounds = { min: number; max: number; collapsible: boolean };

/** The size a splitter starts at when neither `value` nor `defaultValue` is given, before `min` and `max` apply. */
export const DEFAULT_SIZE = 240;

/**
 * The smallest size the bounds allow: 0 when collapsible, else `min`, and
 * never above `max`, which the container may have pulled below `min`.
 */
export function floorSize(bounds: Bounds): number {
  return Math.min(bounds.collapsible ? 0 : bounds.min, bounds.max);
}

/**
 * Pulls `size` into the bounds. A collapsible panel keeps 0, a size below
 * `min` otherwise rises to it, and one past `max` falls to it, also when `max`
 * is below `min`: what the container has room for wins. A size that is not a
 * number reads as the smallest.
 */
export function clampSize(size: number, bounds: Bounds): number {
  if (Number.isNaN(size)) return floorSize(bounds);
  if (bounds.collapsible && size <= 0) return 0;
  return Math.min(Math.max(size, bounds.min), bounds.max);
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
  return clampSize(restore > 0 ? restore : Math.max(bounds.min, step), {
    ...bounds,
    collapsible: false,
  });
}

/**
 * The way a pointer moves along the axis (1 toward larger coordinates, -1
 * toward smaller) when it grows the primary panel. A first panel grows toward
 * larger coordinates, a last one toward smaller, and in a horizontal layout
 * right-to-left text flips both. `orientation` is the axis the panels lie along.
 */
export function growSign(orientation: SplitterOrientation, primary: SplitterPrimary, rtl: boolean): 1 | -1 {
  const flipped = orientation === 'horizontal' && rtl;
  return (primary === 'start') !== flipped ? 1 : -1;
}

/**
 * What a key does, by physical direction, as the ARIA window splitter says: an
 * arrow moves the handle that way. Moving it toward the primary panel
 * shrinks the panel, so which arrow grows it follows {@link growSign}.
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
  const horizontal = orientation === 'horizontal';
  let direction: 1 | -1;
  if (key === (horizontal ? 'ArrowRight' : 'ArrowDown')) direction = 1;
  else if (key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) direction = -1;
  else return null;
  return direction === growSign(orientation, primary, rtl) ? 'grow' : 'shrink';
}

/**
 * The primary panel's size for a pointer at `pointer` along the axis, given the
 * size and pointer position when the drag began and `sign`, from
 * {@link growSign}. Only the distance moved counts, so the handle never
 * jumps and a layout that shifts mid-drag changes nothing.
 */
export function dragSize(pointer: number, startPointer: number, startSize: number, sign: 1 | -1): number {
  return startSize + sign * (pointer - startPointer);
}
