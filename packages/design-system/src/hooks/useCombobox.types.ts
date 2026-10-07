import type { OverlayCloseReason } from '../overlay/useControlledOpen';

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxItem =
  | { kind: 'option'; option: ComboboxOption; id: string }
  | { kind: 'create'; label: string; value: string; id: string };

/** `native` comes from the sheet presentation: something outside Todae closed its `<dialog>`. */
export type ComboboxCloseReason = OverlayCloseReason | 'select' | 'blur' | 'input-clear' | 'native';

export type { SheetPresentation } from './useSheetPresentation';
