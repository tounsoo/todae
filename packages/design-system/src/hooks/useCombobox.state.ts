import { useCallback, useRef, type RefObject } from 'react';
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
  // While `apply` writes, change callbacks wait here, so every change is stored
  // before any callback runs. A held callback still runs only when no later
  // report has replaced it and the field's last request, such as the owner's
  // own from an earlier callback, still asks for its value. A render alone,
  // such as one the owner forces from a callback, changes neither.
  const held = useRef<(() => void)[] | null>(null);
  const reports = useRef<Record<keyof ComboboxFieldState, number>>({ open: 0, inputValue: 0, single: 0, multi: 0 });
  const requested = useRef<Partial<ComboboxFieldState>>({});
  const report = useCallback(<F extends keyof ComboboxFieldState>(field: F, next: ComboboxFieldState[F], call: () => void) => {
    const count = ++reports.current[field];
    if (!held.current) return call();
    held.current.push(() => {
      if (reports.current[field] !== count) return;
      const asked = requested.current[field];
      const same =
        field === 'multi'
          ? sameList(asked as readonly string[], next as readonly string[])
          : Object.is(asked, next);
      if (same) call();
    });
  }, []);
  const [open, setOpen, openNow] = useControlledState<boolean, [reason: ComboboxCloseReason]>(
    options.open,
    options.defaultOpen ?? false,
    options.onOpenChange &&
      ((next, reason) =>
        report(
          'open',
          next,
          () => latest.current.onOpenChange?.(next, reason),
        )),
  );
  const initialSingle = multiple ? null : options.value !== undefined ? options.value : (options.defaultValue ?? null);
  // Only a label we actually know: never seed the input (and the first async query) with a raw id.
  const selectedLabel = options.options?.find((option) => option.value === initialSingle)?.label ?? '';
  const [inputValue, setInput, inputNow] = useControlledState(
    options.inputValue,
    options.defaultInputValue ?? selectedLabel,
    options.onInputValueChange &&
      ((next) =>
        report(
          'inputValue',
          next,
          () => latest.current.onInputValueChange?.(next),
        )),
  );
  const [single, setSingle, singleNow] = useControlledState<string | null>(
    multiple ? undefined : options.value,
    multiple ? null : (options.defaultValue ?? null),
    options.onValueChange &&
      ((next) =>
        report(
          'single',
          next,
          () => {
            const current = latest.current;
            if (!isMultiple(current)) current.onValueChange?.(next);
          },
        )),
  );
  const [multi, setMulti, multiNow] = useControlledState<readonly string[]>(
    multiple ? options.value : undefined,
    multiple ? (options.defaultValue ?? []) : [],
    options.onValueChange &&
      ((next) =>
        report(
          'multi',
          next,
          () => {
            const current = latest.current;
            if (isMultiple(current)) current.onValueChange?.([...next]);
          },
        )),
  );

  /** The field as the last change left it, which writes build on until the next render. */
  const fieldNow = useCallback(
    (): ComboboxFieldState => ({ open: openNow(), inputValue: inputNow(), single: singleNow(), multi: multiNow() }),
    [inputNow, multiNow, openNow, singleNow],
  );

  /**
   * Stores each change that differs from the field's latest state, then calls
   * the change callbacks of those still current. Every callback runs even if
   * one throws; the first throw is rethrown after them.
   */
  const apply = useCallback(
    (changes: ComboboxChanges) => {
      const calls: (() => void)[] = [];
      held.current = calls;
      try {
        const { value, inputValue: text } = changes;
        const asked = requested.current;
        if (typeof value === 'object' && value !== null) {
          asked.multi = value;
          if (!sameList(value, multiNow())) setMulti([...value]);
        } else if (value !== undefined) {
          asked.single = value;
          setSingle(value);
        }
        if (text !== undefined) {
          asked.inputValue = text;
          setInput(text);
        }
        if (changes.open !== undefined) {
          asked.open = changes.open;
          setOpen(changes.open, changes.reason);
        }
      } finally {
        held.current = null;
      }
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
    [multiNow, setInput, setMulti, setOpen, setSingle],
  );

  return { open, inputValue, singleValue: single, multiValue: multi, fieldNow, apply };
}
