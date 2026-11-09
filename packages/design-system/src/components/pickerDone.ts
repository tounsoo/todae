import { createContext, useContext } from 'react';

/**
 * What a panel in a Field.Picker's popover calls on a person's pick, so the
 * field knows a person changed its value: with `complete` true once the pick
 * makes the value, such as a Calendar's date, which closes the popover unless
 * the picker's `closeOnPick` is false; with false for a change that goes on,
 * such as a ColorPicker's drag. Null outside a Field.Picker.
 */
export const PickContext = /* @__PURE__ */ createContext<((complete: boolean) => void) | null>(null);

export const usePicked = () => useContext(PickContext);

/** What a Field.Picker focuses as its popover opens, before its first tabbable: a Calendar's Tab stop, or a list's own element. */
export const PICKER_FOCUS = '[data-todae-calendar-cell][tabindex="0"], [role="listbox"]';
