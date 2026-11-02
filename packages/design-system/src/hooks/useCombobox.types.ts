import type { OverlayCloseReason } from '../overlay/useControlledOpen.js';
import type { ComboboxOption } from './optionList/types.js';

export type { ComboboxOption } from './optionList/types.js';

export type ComboboxItem =
  | { kind: 'option'; option: ComboboxOption; id: string }
  | { kind: 'create'; label: string; value: string; id: string };

/** `form` and `native` come from the sheet and dialog presentations, which are a `<dialog>`; see SheetCloseReason and DialogCloseReason. */
export type ComboboxCloseReason = OverlayCloseReason | 'select' | 'blur' | 'input-clear' | 'reset' | 'form' | 'native';

export type { SheetPresentation } from './useSheetPresentation.js';
