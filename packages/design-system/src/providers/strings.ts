// Server-safe: no hooks or context, so the server entries of Breadcrumbs and
// Pagination can read the English defaults too.

/**
 * Every piece of text Todae writes by itself, such as a default accessible
 * name or a screen reader message. A text that depends on a number or a label
 * is a function. Set any of them for a subtree with StringsProvider; a
 * component's own prop, such as `aria-label` or `removeLabel`, still wins.
 */
export interface Strings {
  /** Name of Dialog.Close and BottomSheet.Close when their own text does not name them. */
  close: string;
  /** Name of Alert.Close and Toast.Close when their own text does not name them. */
  dismiss: string;
  /** Name of the Toast.Region landmark. */
  notifications: string;
  /** Name of the Breadcrumbs.Root landmark. */
  breadcrumbs: string;
  /** Name of the Pagination.Root landmark. */
  pagination: string;
  /** Name of BottomSheet.Grabber's resize control. */
  resizeSheet: string;
  /** Name in the sheet and dialog props from useCombobox's getSheetProps and getDialogProps. */
  options: string;
  /** Name of a chip's remove button. */
  removeChip: (label: string) => string;
  /** Name of Attachment.Remove when its own text does not name it. `name` is Attachment.Name's text, or empty without one. */
  removeAttachment: (name: string) => string;
  /** Name of the +N chip that stands for folded chips. */
  moreChips: (count: number) => string;
  /** Name of ChipList's popover with the folded chips. */
  moreChipsPanel: (count: number) => string;
  /** Field.Counter's description of the input's limit. */
  characterLimit: (max: number) => string;
  /** Field.Counter's live message as the input nears its limit. */
  charactersLeft: (remaining: number) => string;
  /** Field.Counter's live message at or past the limit. */
  characterLimitReached: string;
  /** Label of useCombobox's create row when its `createLabel` is not set. */
  createOption: (query: string) => string;
  /** Name of useMentions' list when its trigger has no `label`. */
  suggestions: string;
  /** useMentions' message when its list opens or its count changes. */
  suggestionCount: (count: number) => string;
  /** Name of ColorPicker.Area's left-to-right input. */
  saturation: string;
  /** Name of ColorPicker.Area's bottom-to-top input. */
  brightness: string;
  /** Name of ColorPicker.Hue when it has no aria-label. */
  hue: string;
  /** Name of Field.ColorPicker's popover, and of its swatch beside another control but a picker. */
  colorPicker: string;
  /** Name of Field.DatePicker's popover, and of its button beside another control but a picker. */
  datePicker: string;
  /** Name of Field.TimePicker's list of times, and of its button beside another control but a picker. */
  timePicker: string;
  /** Name of Calendar.Header's button to the previous month. */
  previousMonth: string;
  /** Name of Calendar.Header's button to the next month. */
  nextMonth: string;
  /** Name of Calendar.Header's button to the previous page of years. */
  previousYears: string;
  /** Name of Calendar.Header's button to the next page of years. */
  nextYears: string;
  /** useClipboard's message after a copy. */
  copied: string;
  /** useClipboard's message when a copy fails. */
  copyFailed: string;
  /** Name of the Conversation.Viewport region when it has no aria-label. */
  conversation: string;
  /** Name of Conversation.ScrollButton when its own text does not name it. */
  scrollToLatest: string;
  /** Conversation's message when a message starts arriving. */
  messageStarted: string;
  /** Conversation's message when a message finishes arriving. */
  messageFinished: string;
  /** Name of Composer.Submit when its own text does not name it. */
  send: string;
  /** Name of Composer.Submit while the composer is busy, when its own text does not name it. */
  stop: string;
}

/** The English Todae ships with. */
export const DEFAULT_STRINGS: Readonly<Strings> = Object.freeze<Strings>({
  close: 'Close',
  dismiss: 'Dismiss',
  notifications: 'Notifications',
  breadcrumbs: 'Breadcrumb',
  pagination: 'Pagination',
  resizeSheet: 'Resize sheet',
  options: 'Options',
  removeChip: (label) => `Remove ${label}`,
  removeAttachment: (name) => (name ? `Remove ${name}` : 'Remove'),
  moreChips: (count) => `${count} more`,
  moreChipsPanel: (count) => `${count} more ${count === 1 ? 'chip' : 'chips'}`,
  characterLimit: (max) => `Up to ${max} characters`,
  charactersLeft: (remaining) => `${remaining} ${remaining === 1 ? 'character' : 'characters'} left`,
  characterLimitReached: 'Character limit reached',
  createOption: (query) => `Create "${query}"`,
  suggestions: 'Suggestions',
  suggestionCount: (count) =>
    count === 0 ? 'No suggestions' : `${count} ${count === 1 ? 'suggestion' : 'suggestions'}`,
  saturation: 'Saturation',
  brightness: 'Brightness',
  hue: 'Hue',
  colorPicker: 'Color picker',
  datePicker: 'Choose date',
  timePicker: 'Choose time',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  previousYears: 'Previous years',
  nextYears: 'Next years',
  copied: 'Copied',
  copyFailed: 'Could not copy',
  conversation: 'Conversation',
  scrollToLatest: 'Scroll to latest message',
  messageStarted: 'New message',
  messageFinished: 'Message complete',
  send: 'Send',
  stop: 'Stop',
});
