import type { ReactNode } from 'react';

/**
 * The glyphs Todae draws by itself. Set any of them for a subtree with
 * GlyphsProvider, such as an icon from your icon library. A key left unset,
 * or set to null, keeps Todae's own drawing. A part's own content, such as
 * Toast.Close children or Chip.Root's removeIcon, still wins.
 */
export interface Glyphs {
  /** Alert.Close, Toast.Close, Dialog.Close, Drawer.Close, BottomSheet.Close and Attachment.Remove with no content, and chip remove buttons. Todae draws a cross. */
  close?: ReactNode;
  /** Checkbox, Menu.CheckboxItem, a selected OptionList.Option and a done Steps.Item. Todae draws a check mark. */
  check?: ReactNode;
  /** Field.Select, Disclosure.Summary, Tree.Label, Nav.Branch, Calendar.Header's month buttons and Conversation.ScrollButton. Point it down: a closed disclosure, tree item or nav branch turns it, and a month button turns it toward its month. The browser's own marker by default; Todae draws one for Tree.Label, Nav.Branch, Calendar.Header and Conversation.ScrollButton. */
  chevron?: ReactNode;
  /** Checkbox.Root while `indeterminate`, in place of the check. Todae draws a horizontal bar. */
  indeterminate?: ReactNode;
  /** Table.SortButton. Point it up: a descending column turns it. Todae draws an arrow pointing up. */
  sort?: ReactNode;
  /** Between Breadcrumbs items. Point it toward the next item in a left-to-right page: it is mirrored in right-to-left. The separator text by default. */
  separator?: ReactNode;
  /** Field.DatePicker's, Field.DateRangePicker's and Field.DateTimePicker's button. Todae draws a calendar. */
  calendar?: ReactNode;
  /** Field.TimePicker's button. Todae draws a clock. */
  clock?: ReactNode;
  /** Field.Increment with no content. Todae draws a plus sign. */
  plus?: ReactNode;
  /** Field.Decrement with no content. Todae draws a minus sign. */
  minus?: ReactNode;
  /** Pagination.Ellipsis with no content. "…" by default. */
  ellipsis?: ReactNode;
  /** Composer.Submit with no content. Todae draws an arrow pointing up. */
  send?: ReactNode;
  /** Composer.Submit with no content while the composer is busy. Todae draws a square. */
  stop?: ReactNode;
  /** A Steps.Item with an error. Todae draws an exclamation mark. */
  error?: ReactNode;
  /** Drilldown.Back with no content. Point it toward the start of a left-to-right line: it is mirrored in right-to-left. Todae draws a chevron. */
  back?: ReactNode;
}
