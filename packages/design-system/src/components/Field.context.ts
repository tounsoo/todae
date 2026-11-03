import { createContext, useContext, type RefObject } from 'react';
import type { FieldRegistry } from './fieldRegistry.js';

export type FieldContextValue = {
  inputId: string;
  hintId: string;
  disabled: boolean;
  invalid: boolean;
  name?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
  /** The shell element. */
  shellRef: RefObject<HTMLDivElement | null>;
  /** The field's controls, counter, stepper and value inputs. */
  registry: FieldRegistry;
};

export const FieldContext = /* @__PURE__ */ createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Field parts must be rendered inside Field.Root');
  return ctx;
}

/** The elements a press on the shell can focus. */
export const FIELD_CONTROL_SELECTOR = 'input, textarea, select, [data-todae-field-control]';

/** Of those, the ones a press can actually focus. */
export const FOCUSABLE_FIELD_CONTROL_SELECTOR =
  "input:not([type='hidden']):not([data-todae-value-input]):not(:disabled), textarea:not(:disabled), select:not(:disabled), [data-todae-field-control]:not(:disabled):not([aria-disabled='true'])";

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
