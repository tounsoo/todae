import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { UseComboboxMultipleOptions, UseComboboxOptions } from './useCombobox.js';
import type { ComboboxCloseReason } from './useCombobox.types.js';
import { useControlledState } from './useControlledState.js';

/** The field as the last change left it. Only the parts the hook owns can be ahead of the last render. */
export type ComboboxFieldState = {
  open: boolean;
  inputValue: string;
  single: string | null;
  multi: readonly string[];
};

/** A value is a list in multiple mode and a string or null in single mode. */
export type ComboboxChanges = {
  value?: string | null | readonly string[];
  inputValue?: string;
} & ({ open?: undefined } | { open: boolean; reason: ComboboxCloseReason });

export function isMultiple(options: UseComboboxOptions): options is UseComboboxMultipleOptions {
  return options.selectionMode === 'multiple';
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * The combobox's value, text and open state, each a prop it may own, and `apply`,
 * the one way to change them.
 */
export function useComboboxState(options: UseComboboxOptions, latest: RefObject<UseComboboxOptions>) {
  const multiple = isMultiple(options);
  const [open, setOpen] = useControlledState(options.open, options.defaultOpen ?? false);
  const initialSingle = multiple ? null : options.value !== undefined ? options.value : (options.defaultValue ?? null);
  // Only a label we actually know: never seed the input (and the first async query) with a raw id.
  const selectedLabel = options.options?.find((option) => option.value === initialSingle)?.label ?? '';
  const [inputValue, setInput] = useControlledState(options.inputValue, options.defaultInputValue ?? selectedLabel);
  const [single, setSingle] = useControlledState(
    multiple ? undefined : options.value,
    multiple ? null : (options.defaultValue ?? null),
  );
  const [multi, setMulti] = useControlledState<readonly string[]>(
    multiple ? options.value : undefined,
    multiple ? (options.defaultValue ?? []) : [],
  );

  const state = useRef<ComboboxFieldState>({ open, inputValue, single, multi });
  // Each render brings it back to what the field shows, so it follows a controlled
  // owner's own changes.
  useLayoutEffect(() => {
    state.current = { open, inputValue, single, multi };
  });

  /**
   * Stores each change that differs from the field's latest state, then calls its
   * change callback. Every callback runs even if one throws; the first throw is
   * rethrown after them.
   */
  const apply = useCallback(
    (changes: ComboboxChanges) => {
      const now = state.current;
      const current = latest.current;
      const next = { ...now };
      const calls: (() => void)[] = [];
      const { value } = changes;
      if (typeof value === 'object' && value !== null) {
        if (!sameList(value, now.multi)) {
          const list = [...value];
          next.multi = list;
          setMulti(list);
          if (isMultiple(current)) calls.push(() => current.onValueChange?.(list));
        }
      } else if (value !== undefined && !Object.is(value, now.single)) {
        next.single = value;
        setSingle(value);
        if (!isMultiple(current)) calls.push(() => current.onValueChange?.(value));
      }
      const text = changes.inputValue;
      if (text !== undefined && text !== now.inputValue) {
        next.inputValue = text;
        setInput(text);
        calls.push(() => current.onInputValueChange?.(text));
      }
      if (changes.open !== undefined && changes.open !== now.open) {
        const { open: nextOpen, reason } = changes;
        next.open = nextOpen;
        setOpen(nextOpen);
        calls.push(() => current.onOpenChange?.(nextOpen, reason));
      }
      // A controlled part stays at what its owner rendered until the owner renders
      // another, so a change it turns down is neither kept nor built on.
      const single = !isMultiple(current) ? current.value : undefined;
      const multi = isMultiple(current) ? current.value : undefined;
      state.current = {
        open: current.open ?? next.open,
        inputValue: current.inputValue ?? next.inputValue,
        single: single !== undefined ? single : next.single,
        multi: multi ?? next.multi,
      };
      let failure: { error: unknown } | null = null;
      for (const call of calls) {
        try {
          call();
        } catch (error) {
          failure ??= { error };
        }
      }
      if (failure) throw failure.error;
    },
    [latest, setInput, setMulti, setOpen, setSingle],
  );

  return { open, inputValue, singleValue: single, multiValue: multi, state, apply };
}
