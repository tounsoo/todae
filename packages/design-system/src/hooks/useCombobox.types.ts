import type { OverlayCloseReason } from '../overlay/useControlledOpen';

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxItem =
  | { kind: 'option'; option: ComboboxOption; id: string }
  | { kind: 'create'; label: string; value: string; id: string };

export type ComboboxCloseReason = OverlayCloseReason | 'select' | 'blur' | 'input-clear';

export type { SheetPresentation } from './useSheetPresentation';
