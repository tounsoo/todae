import type { OverlayCloseReason } from '../overlay/useControlledOpen';

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxItem =
  | { kind: 'option'; option: ComboboxOption; id: string }
  | { kind: 'create'; label: string; value: string; id: string };

/** `form` and `native` come from the sheet presentation, which is a `<dialog>`; see SheetCloseReason. */
export type ComboboxCloseReason = OverlayCloseReason | 'select' | 'blur' | 'input-clear' | 'form' | 'native';

export type { SheetPresentation } from './useSheetPresentation';
