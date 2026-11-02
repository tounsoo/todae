import { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react';

/**
 * The one model for a value a prop can own. While `prop` is not `undefined` it
 * is the value; otherwise the hook keeps its own, starting at `defaultValue`.
 *
 * The setter builds on the latest write, not on the last render: it skips a
 * value `Object.is` equal to the latest write, stores it when uncontrolled,
 * then calls `onChange` with the value and any extra arguments, such as a
 * reason. So two writes before a render both count. A controlled write also
 * renders the hook again, and that render, or one with a new value, makes the
 * rendered value the base again, so a change the owner has not passed back by
 * then is dropped and the next write builds on the value it passed. A controlled value with no
 * `onChange` has no one to ask, so a write to it does nothing.
 *
 * `latest()` reads the value the next write builds on. `onChange` is read when
 * the setter runs, so the setter keeps its identity while the hook stays
 * controlled or uncontrolled.
 */
export function useControllableState<T, A extends unknown[] = []>(
  prop: T | undefined,
  defaultValue: T,
  onChange?: (next: T, ...args: A) => void,
): [value: T, set: (next: T, ...args: A) => void, latest: () => T] {
  const [own, setOwn] = useState(defaultValue);
  const [renders, rerender] = useReducer((count: number) => count + 1, 0);
  const controlled = prop !== undefined;
  const value = controlled ? prop : own;
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
      if (controlled && !change.current) return;
      if (Object.is(next, base.current)) return;
      base.current = next;
      if (controlled) rerender();
      else setOwn(() => next);
      change.current?.(next, ...args);
    },
    [controlled],
  );
  const latest = useCallback(() => base.current, []);
  return [value, set, latest];
}

/**
 * State a prop can own, for products. When `controlled` is not `undefined` it
 * is the value and the setter does nothing; otherwise the hook keeps its own
 * state, starting at `defaultValue`. The setter never calls a change callback.
 * Todae's own parts use {@link useControllableState}.
 */
export function useControlledState<T>(
  controlled: T | undefined,
  defaultValue: T,
): [T, (next: T) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : uncontrolled;
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
    },
    [isControlled],
  );
  return [value, setValue];
}

/**
 * {@link useControlledState} with the change callback built in, for products:
 * the setter skips a value equal to the one from the last render, stores it
 * when uncontrolled, then calls `onChange` with the value and any extra
 * arguments, such as a reason. Todae's own parts use
 * {@link useControllableState}, whose writes build on each other.
 */
export function useControlledValue<T, A extends unknown[] = []>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (next: T, ...args: A) => void,
): [T, (next: T, ...args: A) => void] {
  const [value, setValue] = useControlledState(controlled, defaultValue);
  const change = useCallback(
    (next: T, ...args: A) => {
      if (Object.is(next, value)) return;
      setValue(next);
      onChange?.(next, ...args);
    },
    [onChange, setValue, value],
  );
  return [value, change];
}
