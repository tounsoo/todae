import { useCallback, useState } from 'react';

/**
 * State a prop can own. When `controlled` is not `undefined` it is the value
 * and the setter does nothing; otherwise the hook keeps its own state,
 * starting at `defaultValue`. The setter never calls a change callback.
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
 * {@link useControlledState} with the change callback built in: the setter
 * skips a value equal to the one from the last render, stores it when uncontrolled, then
 * calls `onChange` with the value and any extra arguments, such as a reason.
 * The third entry stores a value without calling `onChange`, for a reset
 * the product didn't ask for.
 */
export function useControlledValue<T, A extends unknown[] = []>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (next: T, ...args: A) => void,
): [T, (next: T, ...args: A) => void, (next: T) => void] {
  const [value, setValue] = useControlledState(controlled, defaultValue);
  const change = useCallback(
    (next: T, ...args: A) => {
      if (Object.is(next, value)) return;
      setValue(next);
      onChange?.(next, ...args);
    },
    [onChange, setValue, value],
  );
  return [value, change, setValue];
}
