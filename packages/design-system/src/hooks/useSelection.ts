import { useCallback, useLayoutEffect, useMemo, useReducer, useRef, type ChangeEvent } from 'react';
import type { CheckboxRootProps } from '../components/Checkbox.js';
import { composeHandlers } from '../components/props.js';
import { useControlledState } from './useControlledState.js';

export type SelectionState = 'none' | 'some' | 'all';

export type UseSelectionOptions<K extends string | number> = {
  /** The keys that can be selected now, in display order, such as the rows on the current page. Selected keys outside this list, such as those on other pages, are kept. */
  keys: readonly K[];
  /** Keys that cannot be selected: ranges and select all skip them, and their checkbox is disabled. */
  disabledKeys?: readonly K[];
  /** Controlled selection, in the order keys were selected. Defined means controlled. A change you haven't passed back by the render that follows it, such as one you pass back after a fetch or in a transition that commits later, is forgotten, and the next change builds on the value you passed. */
  value?: readonly K[];
  /** Initial selection when uncontrolled. */
  defaultValue?: readonly K[];
  /** Fires with the new selection after it changes. */
  onValueChange?: (value: K[]) => void;
};

type CheckboxProps = Omit<CheckboxRootProps, 'children'>;

export type UseSelectionResult<K extends string | number> = {
  /** The selected keys, in the order they were selected. */
  value: readonly K[];
  /** Whether `key` is selected. */
  isSelected: (key: K) => boolean;
  /** Whether none, some or all of the enabled keys in `keys` are selected. `none` when there are no enabled keys. */
  state: SelectionState;
  /** Selects `key` when it is not selected and clears it when it is. `range` sets every enabled key between the last toggled key and `key`, in `keys` order, to the new state of `key`. A disabled `key` does nothing. */
  toggle: (key: K, options?: { range?: boolean }) => void;
  /** Clears every enabled key in `keys` when all are selected, otherwise selects them all. Keys outside `keys` stay as they are. */
  toggleAll: () => void;
  /** Empties the selection, including keys outside `keys`. */
  clear: () => void;
  /** Props for the `Checkbox.Root` of one key: `checked`, `disabled` and an `onChange` that toggles it, as a range while Shift is held. Yours merge in, and your `onChange` runs first. */
  getCheckboxProps: (key: K, props?: CheckboxProps) => CheckboxProps & Pick<Required<CheckboxProps>, 'checked' | 'disabled' | 'onChange'>;
  /** Props for the select-all `Checkbox.Root`: `checked` when all are selected, `indeterminate` when some are, and an `onChange` that calls `toggleAll`. Yours merge in, and your `onChange` runs first. */
  getSelectAllProps: (props?: CheckboxProps) => CheckboxProps & Pick<Required<CheckboxProps>, 'checked' | 'indeterminate' | 'disabled' | 'onChange'>;
};

const NO_KEYS: readonly never[] = [];

/** The keys from `from` to `to`, both included, in `keys` order; null when either is not in `keys`. */
function keysBetween<K>(keys: readonly K[], from: K, to: K): K[] | null {
  const start = keys.indexOf(from);
  const end = keys.indexOf(to);
  if (start < 0 || end < 0) return null;
  return keys.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** `value` after setting `targets` to `selected`, new keys added once each in the order given. The same array when nothing changes. */
function withSelected<K>(value: readonly K[], targets: readonly K[], selected: boolean): readonly K[] {
  const present = new Set(value);
  const changed = new Set(targets.filter((key) => present.has(key) !== selected));
  if (changed.size === 0) return value;
  if (selected) return [...value, ...changed];
  return value.filter((key) => !changed.has(key));
}

/**
 * Keeps a selection of keys, such as the rows of a table, and returns prop
 * getters that wire it to `Checkbox.Root`: one for each row and one for a
 * select-all box in the header. Shift held on a row's checkbox selects or
 * clears every enabled row from the last toggled one.
 */
export function useSelection<K extends string | number>(options: UseSelectionOptions<K>): UseSelectionResult<K> {
  const { keys, disabledKeys = NO_KEYS, value: valueProp, defaultValue, onValueChange } = options;
  const [value, setValue] = useControlledState<readonly K[]>(valueProp, defaultValue ?? NO_KEYS);
  // Writes build on each other until the value changes, so two calls both
  // count. A controlled write also forces a render that makes the rendered
  // value the base again, so a change the parent turned down is dropped.
  const latest = useRef(value);
  const [renders, rerender] = useReducer((count: number) => count + 1, 0);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value, renders]);
  const write = (next: readonly K[]) => {
    if (next === latest.current) return;
    latest.current = next;
    setValue(next);
    if (valueProp !== undefined) rerender();
    onValueChange?.([...next]);
  };

  const selected = useMemo(() => new Set<K>(value), [value]);
  const disabled = useMemo(() => new Set<K>(disabledKeys), [disabledKeys]);
  const uniqueKeys = useMemo(() => [...new Set(keys)], [keys]);
  const enabledKeys = useMemo(() => uniqueKeys.filter((key) => !disabled.has(key)), [uniqueKeys, disabled]);
  const anchor = useRef<K | null>(null);

  const selectedCount = enabledKeys.filter((key) => selected.has(key)).length;
  const state: SelectionState =
    selectedCount === 0 ? 'none' : selectedCount === enabledKeys.length ? 'all' : 'some';

  const isSelected = useCallback((key: K) => selected.has(key), [selected]);

  const toggle = (key: K, { range = false }: { range?: boolean } = {}) => {
    if (disabled.has(key)) return;
    const next = !latest.current.includes(key);
    const span = range && anchor.current !== null ? keysBetween(uniqueKeys, anchor.current, key) : null;
    anchor.current = key;
    write(withSelected(latest.current, span ? span.filter((k) => !disabled.has(k)) : [key], next));
  };

  const toggleAll = () => {
    anchor.current = null;
    const current = new Set(latest.current);
    write(withSelected(latest.current, enabledKeys, !enabledKeys.every((key) => current.has(key))));
  };

  const clear = () => {
    anchor.current = null;
    if (latest.current.length > 0) write(NO_KEYS);
  };

  const getCheckboxProps: UseSelectionResult<K>['getCheckboxProps'] = (key, props = {}) => ({
    ...props,
    checked: selected.has(key),
    disabled: !!props.disabled || disabled.has(key),
    onChange: composeHandlers(props.onChange, (event: ChangeEvent<HTMLInputElement>) => {
      // React fires a checkbox's change from its click, which carries the modifier keys.
      const click = event.nativeEvent;
      toggle(key, { range: 'shiftKey' in click && click.shiftKey === true });
    }),
  });

  const getSelectAllProps: UseSelectionResult<K>['getSelectAllProps'] = (props = {}) => ({
    ...props,
    checked: state === 'all',
    indeterminate: state === 'some',
    disabled: !!props.disabled || enabledKeys.length === 0,
    onChange: composeHandlers(props.onChange, toggleAll),
  });

  return { value, isSelected, state, toggle, toggleAll, clear, getCheckboxProps, getSelectAllProps };
}
