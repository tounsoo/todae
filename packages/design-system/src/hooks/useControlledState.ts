import { useCallback, useState } from 'react';

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
 * skips a value equal to the current one, stores it when uncontrolled, then
 * calls `onChange` with the value and any extra arguments, such as a reason.
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
