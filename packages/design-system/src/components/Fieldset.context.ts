import { createContext, useContext } from 'react';

export type FieldsetContextValue = { disabled: boolean; invalid: boolean };

const NONE: FieldsetContextValue = { disabled: false, invalid: false };

export const FieldsetContext = createContext<FieldsetContextValue>(NONE);

/**
 * What the controls in a fieldset's legend see: the fieldsets around it.
 * Natively they are not disabled by the fieldset the legend names, and they
 * are not part of the group its invalid state is about.
 */
export const FieldsetLegendContext = createContext<FieldsetContextValue>(NONE);

/**
 * A control's own disabled and invalid, merged with the nearest
 * Fieldset.Root's. A disabled fieldset disables every control, as natively.
 * An invalid one marks each control that leaves `invalid` unset; pass
 * `invalid={false}` on one the person got right.
 */
export function useFieldsetState(own: { disabled?: boolean; invalid?: boolean }): FieldsetContextValue {
  const fieldset = useContext(FieldsetContext);
  return {
    disabled: Boolean(own.disabled) || fieldset.disabled,
    invalid: own.invalid ?? fieldset.invalid,
  };
}
