import type { ReactNode } from 'react';

/**
 * The glyphs Todae draws by itself. Set any of them for a subtree with
 * GlyphsProvider, such as an icon from your icon library. A key left unset,
 * or set to null, keeps Todae's own drawing. A part's own content, such as
 * Toast.Close children or Chip.Root's removeIcon, still wins.
 */
export interface Glyphs {
  /** Alert.Close, Toast.Close, Dialog.Close, BottomSheet.Close and Attachment.Remove with no content, and chip remove buttons. Todae draws a cross. */
  close?: ReactNode;
  /** Checkbox, Menu.CheckboxItem and a selected OptionList.Option. Todae draws a check mark. */
  check?: ReactNode;
  /** Field.Select, Disclosure.Summary, Tree.Label, Calendar.Header's month buttons and Conversation.ScrollButton. Point it down: a closed disclosure or tree item turns it, and a month button turns it toward its month. The browser's own marker by default; Todae draws one for Tree.Label, Calendar.Header and Conversation.ScrollButton. */
  chevron?: ReactNode;
  /** Between Breadcrumbs items. Point it toward the next item in a left-to-right page: it is mirrored in right-to-left. The separator text by default. */
  separator?: ReactNode;
  /** Field.DatePicker's button. Todae draws a calendar. */
  calendar?: ReactNode;
  /** Pagination.Ellipsis with no content. "…" by default. */
  ellipsis?: ReactNode;
  /** Composer.Submit with no content. Todae draws an arrow pointing up. */
  send?: ReactNode;
  /** Composer.Submit with no content while the composer is busy. Todae draws a square. */
  stop?: ReactNode;
}
