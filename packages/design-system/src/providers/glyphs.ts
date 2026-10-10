import type { ReactNode } from 'react';

/**
 * The glyphs Todae draws by itself. Set any of them for a subtree with
 * GlyphsProvider, such as an icon from your icon library. A key left unset,
 * or set to null, keeps Todae's own drawing. A part's own content, such as
 * Toast.Close children or Chip.Root's removeIcon, still wins.
 */
export interface Glyphs {
  /** Alert.Close, Toast.Close, Dialog.Close and BottomSheet.Close with no content, and chip remove buttons. Todae draws a cross. */
  close?: ReactNode;
  /** Checkbox, Menu.CheckboxItem and a selected OptionList.Option. Todae draws a check mark. */
  check?: ReactNode;
  /** Field.Select, Disclosure.Summary and Tree.Label. Point it down: a closed disclosure or tree item turns it. The browser's own marker by default; Todae draws one for Tree.Label. */
  chevron?: ReactNode;
  /** Between Breadcrumbs items. Point it toward the next item in a left-to-right page: it is mirrored in right-to-left. The separator text by default. */
  separator?: ReactNode;
  /** Pagination.Ellipsis with no content. "…" by default. */
  ellipsis?: ReactNode;
}
