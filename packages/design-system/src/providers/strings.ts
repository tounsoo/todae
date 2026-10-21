// Server-safe: no hooks or context, so the server entries of Breadcrumbs and
// Pagination can read the English defaults too.

/**
 * Every piece of text Todae writes by itself, such as a default accessible
 * name or a screen reader message. A text that depends on a number or a label
 * is a function. Set any of them for a subtree with StringsProvider; a
 * component's own prop, such as `aria-label` or `removeLabel`, still wins.
 */
export interface Strings {
  /** Name of Dialog.Close, Drawer.Close and BottomSheet.Close when their own text does not name them. */
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
  /** Name of Field.TimePicker's and Field.DateTimePicker's list of times, and of Field.TimePicker's button beside another control but a picker. */
  timePicker: string;
  /** Name of Field.DateTimePicker's popover, and of its button beside another control but a picker. */
  dateTimePicker: string;
  /** Name of Field.Increment when its own text does not name it, given the text of its Field.NumberInput's label, or an empty string without one. */
  increment: (field: string) => string;
  /** Name of Field.Decrement when its own text does not name it, given the text of its Field.NumberInput's label, or an empty string without one. */
  decrement: (field: string) => string;
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
  /** Table.SortButton's message after its column becomes sorted in ascending order. `column` is the button's label. */
  sortedAscending: (column: string) => string;
  /** Table.SortButton's message after its column becomes sorted in descending order. `column` is the button's label. */
  sortedDescending: (column: string) => string;
  /** Table.SortButton's message after its column is no longer sorted. `column` is the button's label. */
  sortCleared: (column: string) => string;
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
  /** Steps.Item's hidden status word for a `done` step, read before the step's text. */
  stepDone: string;
  /** Steps.Item's hidden status word for the `current` step. */
  stepCurrent: string;
  /** Steps.Item's hidden status word for a `pending` step. */
  stepPending: string;
  /** Steps.Item's hidden status word for a step with an `error`. */
  stepError: string;
  /** What a required Field.DatePicker, Field.TimePicker or Field.DateTimePicker button, and a required Field.ChipInput's text box, is described by: a button cannot say `aria-required`, and the text box is not what must be filled. */
  required: string;
  /** Text of a control the browser reports empty though it is required. */
  valueMissing: string;
  /** Text of an `email` input whose value is not an email address. */
  typeMismatchEmail: string;
  /** Text of a `url` input whose value is not a URL. */
  typeMismatchUrl: string;
  /** Text of an input whose value does not fit its type, other than `email` and `url`. */
  typeMismatch: string;
  /** Text of an input whose entry the browser cannot turn into a value, such as a number that is only a sign. */
  badInput: string;
  /** Text of an input whose value does not match its `pattern`. */
  patternMismatch: string;
  /** Text of a value shorter than the control's `minLength`. */
  tooShort: (min: number) => string;
  /** Text of a value longer than the control's `maxLength`. */
  tooLong: (max: number) => string;
  /** Text of a value below the control's `min`. `min` is the attribute's text. */
  rangeUnderflow: (min: string) => string;
  /** Text of a value above the control's `max`. `max` is the attribute's text. */
  rangeOverflow: (max: string) => string;
  /** Text of a date, time, or date and time before the control's `min`. `min` is in the field's own format. */
  dateRangeUnderflow: (min: string) => string;
  /** Text of a date, time, or date and time after the control's `max`. `max` is in the field's own format. */
  dateRangeOverflow: (max: string) => string;
  /** Text of a value that does not fit the control's `step`. */
  stepMismatch: string;
  /** Form.Summary's title, with the number of problems it lists. */
  formErrors: (count: number) => string;
}

/** The English Todae ships with. */
export const DEFAULT_STRINGS: Readonly<Strings> = /* @__PURE__ */ Object.freeze<Strings>({
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
  dateTimePicker: 'Choose date and time',
  increment: (field) => (field ? `Increase ${field}` : 'Increase'),
  decrement: (field) => (field ? `Decrease ${field}` : 'Decrease'),
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  previousYears: 'Previous years',
  nextYears: 'Next years',
  copied: 'Copied',
  copyFailed: 'Could not copy',
  sortedAscending: (column) => `Sorted by ${column}, ascending`,
  sortedDescending: (column) => `Sorted by ${column}, descending`,
  sortCleared: (column) => `${column}, not sorted`,
  conversation: 'Conversation',
  scrollToLatest: 'Scroll to latest message',
  messageStarted: 'New message',
  messageFinished: 'Message complete',
  send: 'Send',
  stop: 'Stop',
  stepDone: 'Done',
  stepCurrent: 'In progress',
  stepPending: 'Not started',
  stepError: 'Failed',
  required: 'Required',
  valueMissing: 'This field is required',
  typeMismatchEmail: 'Enter an email address',
  typeMismatchUrl: 'Enter a URL',
  typeMismatch: 'Enter a value in the right format',
  badInput: 'Enter a valid value',
  patternMismatch: 'Match the requested format',
  tooShort: (min) => `Use at least ${min} ${min === 1 ? 'character' : 'characters'}`,
  tooLong: (max) => `Use at most ${max} ${max === 1 ? 'character' : 'characters'}`,
  rangeUnderflow: (min) => `Enter ${min} or more`,
  rangeOverflow: (max) => `Enter ${max} or less`,
  dateRangeUnderflow: (min) => `Enter ${min} or later`,
  dateRangeOverflow: (max) => `Enter ${max} or earlier`,
  stepMismatch: 'Enter a value that fits the allowed steps',
  formErrors: (count) => `${count} ${count === 1 ? 'problem' : 'problems'} to fix`,
});
