import { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react';

/**
 * The one model for a value a prop can own, used by todae's own parts and
 * exported for products. While `controlled` is not `undefined` it is the
 * value; otherwise the hook keeps its own, starting at `defaultValue`. So a
 * controlled empty value is `null`.
 *
 * The setter takes a value, not an updater, and builds on the latest write,
 * not on the last render: it skips a value `Object.is` equal to the latest
 * write, stores it when uncontrolled, then calls `onChange` with the value and
 * any extra arguments, such as a reason. So two writes before a render both
 * count. A controlled write also renders the hook again, and that render, or
 * one with a new value, makes the rendered value the base again: a change the
 * owner has not passed back by then is dropped, and the next write builds on
 * the value it passed. A controlled value with no `onChange` has no one to
 * ask, so a write to it does nothing.
 *
 * `latest()` reads the value the next write builds on. `onChange` is read when
 * the setter runs, so the setter keeps its identity while the hook stays
 * controlled or uncontrolled.
 */
export function useControlledState<T, A extends unknown[] = []>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (next: T, ...args: A) => void,
): [value: T, set: (next: T, ...args: A) => void, latest: () => T] {
  const [own, setOwn] = useState(defaultValue);
  const [renders, rerender] = useReducer((count: number) => count + 1, 0);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : own;
  const base = useRef(value);
  const change = useRef(onChange);
  // Only a new value or a controlled write's own render resets the base, so an
  // urgent render that doesn't hold a pending write yet, such as one in a
  // transition, doesn't drop it.
  useLayoutEffect(() => {
    base.current = value;
  }, [value, renders]);
  useLayoutEffect(() => {
    change.current = onChange;
  });
  const set = useCallback(
    (next: T, ...args: A) => {
      if (isControlled && !change.current) return;
      if (Object.is(next, base.current)) return;
      base.current = next;
      if (isControlled) rerender();
      else setOwn(() => next);
      change.current?.(next, ...args);
    },
    [isControlled],
  );
  const latest = useCallback(() => base.current, []);
  return [value, set, latest];
}
