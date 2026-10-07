import { createContext, useContext } from 'react';

export type FieldsetContextValue = { disabled: boolean; invalid: boolean };

const NONE: FieldsetContextValue = { disabled: false, invalid: false };

export const FieldsetContext = createContext<FieldsetContextValue>(NONE);

/**
 * What the controls in a fieldset's legend see. Natively they are not
 * disabled by the fieldset the legend names, only by fieldsets around it.
 */
export const FieldsetLegendContext = createContext<FieldsetContextValue>(NONE);

/** The nearest Fieldset.Root's state, or neither disabled nor invalid outside one. */
export function useFieldset(): FieldsetContextValue {
  return useContext(FieldsetContext);
}
