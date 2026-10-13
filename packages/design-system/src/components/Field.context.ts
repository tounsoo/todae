import { createContext, useCallback, useContext, useRef, type RefObject } from 'react';

type CountEntry = { value: string; maxLength?: number };

export type CountStore = {
  entry: CountEntry | null;
  counters: number;
  listeners: Set<() => void>;
  presence: Set<() => void>;
};

export type FieldContextValue = {
  inputId: string;
  hintId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  /** The control the shell focuses on a press outside it. */
  inputRef: RefObject<HTMLElement | null>;
  /** The shell element. */
  shellRef: RefObject<HTMLDivElement | null>;
  store: CountStore;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
}

/** The elements a press on the shell can focus. */
export const FIELD_CONTROL_SELECTOR = 'input, textarea, select, [data-todae-field-control]';

/** Of those, the ones a press can actually focus. */
export const FOCUSABLE_FIELD_CONTROL_SELECTOR =
  "input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled), [data-todae-field-control]:not(:disabled):not([aria-disabled='true'])";

/**
 * A stable ref callback that makes a control the one the shell focuses. On
 * detach it clears the Root's ref only if it still points at this control, so
 * another control under the same Root keeps it.
 */
export function useControlSetter(inputRef: RefObject<HTMLElement | null>): (node: HTMLElement | null) => void {
  const own = useRef<HTMLElement | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      if (node) inputRef.current = node;
      else if (inputRef.current === own.current) inputRef.current = null;
      own.current = node;
    },
    [inputRef],
  );
}

export function mergeDescribedBy(root?: string, own?: string, hint?: string) {
  const ids = [root, own, hint].filter((id): id is string => Boolean(id));
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type LabelAttrs = { 'aria-label'?: string; 'aria-labelledby'?: string };

/**
 * An input that names itself keeps both of its own label attributes and takes
 * neither from the Root: a Root `aria-labelledby` would outrank the input's
 * own `aria-label`.
 */
export function inputLabel(own: LabelAttrs, field: { ariaLabel?: string; labelledBy?: string }): LabelAttrs {
  if (own['aria-label'] != null || own['aria-labelledby'] != null) {
    return { 'aria-label': own['aria-label'], 'aria-labelledby': own['aria-labelledby'] };
  }
  return { 'aria-label': field.ariaLabel, 'aria-labelledby': field.labelledBy };
}
