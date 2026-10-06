import { createContext, useContext, type RefObject } from 'react';

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
  store: CountStore;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
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
