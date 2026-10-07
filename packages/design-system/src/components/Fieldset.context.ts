import { createContext, useContext } from 'react';

export type FieldsetContextValue = { disabled: boolean; invalid: boolean };

const NONE: FieldsetContextValue = { disabled: false, invalid: false };

export const FieldsetContext = createContext<FieldsetContextValue>(NONE);

/** The nearest Fieldset.Root's state, or neither disabled nor invalid outside one. */
export function useFieldset(): FieldsetContextValue {
  return useContext(FieldsetContext);
}
