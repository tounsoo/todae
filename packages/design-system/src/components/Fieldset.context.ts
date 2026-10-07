import { createContext, useContext } from 'react';

export type FieldsetContextValue = { disabled: boolean; invalid: boolean };

const NONE: FieldsetContextValue = { disabled: false, invalid: false };

export const FieldsetContext = createContext<FieldsetContextValue>(NONE);

/**
 * What the controls in a fieldset's legend see. Natively they are not
 * disabled by the fieldset the legend names, only by fieldsets around it.
 */
export const FieldsetLegendContext = createContext<FieldsetContextValue>(NONE);

/**
 * A control's own disabled and invalid, merged with the nearest
 * Fieldset.Root's. Outside a fieldset they are the control's own.
 */
export function useFieldsetState(own: { disabled?: boolean; invalid?: boolean }): FieldsetContextValue {
  const fieldset = useContext(FieldsetContext);
  return {
    disabled: Boolean(own.disabled) || fieldset.disabled,
    invalid: Boolean(own.invalid) || fieldset.invalid,
  };
}
