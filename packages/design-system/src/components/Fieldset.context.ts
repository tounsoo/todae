import { createContext, useContext } from 'react';

export type FieldsetContextValue = {
  disabled: boolean;
  invalid: boolean;
  /** The error a validation scope around the control shows, for its `aria-describedby`. */
  errorId?: string;
};

const NONE: FieldsetContextValue = { disabled: false, invalid: false };

export const FieldsetContext = /* @__PURE__ */ createContext<FieldsetContextValue>(NONE);

/**
 * What the controls in a fieldset's legend see: the fieldsets around it.
 * Natively they are not disabled by the fieldset the legend names, and they
 * are not part of the group its invalid state is about.
 */
export const FieldsetLegendContext = /* @__PURE__ */ createContext<FieldsetContextValue>(NONE);

/**
 * A control's own disabled and invalid, merged with the nearest
 * Fieldset.Root's. A disabled fieldset disables every control, as natively.
 * An invalid one marks each control that leaves `invalid` unset; pass
 * `invalid={false}` on one the person got right. A validation scope adds its
 * shown error to `invalid` and its id to `errorId`.
 */
export function useFieldsetState(own: { disabled?: boolean; invalid?: boolean }): FieldsetContextValue {
  const fieldset = useContext(FieldsetContext);
  return {
    disabled: Boolean(own.disabled) || fieldset.disabled,
    invalid: own.invalid ?? fieldset.invalid,
    errorId: fieldset.errorId,
  };
}
