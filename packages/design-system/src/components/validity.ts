import type { Strings } from '../providers/strings.js';

/** What a message says is wrong, from the first failed flag of a control's `ValidityState`, or `server` for an entry in `Form.Root`'s `errors`. */
export type ValidityKind =
  | 'valueMissing'
  | 'typeMismatch'
  | 'badInput'
  | 'patternMismatch'
  | 'tooShort'
  | 'tooLong'
  | 'rangeUnderflow'
  | 'rangeOverflow'
  | 'stepMismatch'
  | 'customError'
  | 'server';

/** What a validation scope shows: why, and the text in the page's language. */
export type FormFieldError = { kind: ValidityKind; message: string };

/** The native form controls that take part in constraint validation. */
export type ValidityCarrier = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Matches what the browser lets take part in constraint validation; `willValidate` says whether this one does now. */
export function isValidityCarrier(node: EventTarget | null): node is ValidityCarrier {
  return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
}

/** The labels a value input's `min` and `max` are worded with, already in the field's own format, such as "Oct 7, 2026". */
export type ValueInputBound = { min?: string; max?: string };

type ValueInputEntry = { owner: () => HTMLElement | null; bound: ValueInputBound };

// For each value input, who it speaks for. Written by useField's getValueInputProps after each commit.
const valueInputs = /* @__PURE__ */ new WeakMap<ValidityCarrier, ValueInputEntry>();

// For each field, its value input, so a rule that goes on the field's control can go there when the control is not a carrier.
const fieldValueInputs = /* @__PURE__ */ new WeakMap<object, ValidityCarrier>();

/** Makes `el` a value input of `field`: `owner` finds the visible control it speaks for, and `bound` words its `min` and `max`. */
export function registerValueInput(el: ValidityCarrier, field: object, entry: ValueInputEntry): void {
  valueInputs.set(el, entry);
  fieldValueInputs.set(field, el);
}

/** The field's value input while it is in the page, else null. */
export function valueInputOf(field: object): ValidityCarrier | null {
  const el = fieldValueInputs.get(field);
  return el?.isConnected ? el : null;
}

/** The element focus goes to for a control: its field's visible control for a value input, else itself. */
export function focusTargetFor(el: ValidityCarrier): HTMLElement {
  return valueInputs.get(el)?.owner() ?? el;
}

/** What a person reaches for a control, and whether they can: a value input is hidden, so it is its field's control, which must be enabled too. */
export function reachTarget(el: ValidityCarrier): { target: HTMLElement; disabled: boolean } {
  const target = focusTargetFor(el);
  return { target, disabled: el.matches(':disabled') || target.matches(':disabled') };
}

// The order the first failed flag is picked in: what is missing before what is malformed before what is out of range.
const FLAGS = [
  'valueMissing',
  'typeMismatch',
  'badInput',
  'patternMismatch',
  'tooShort',
  'tooLong',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'customError',
] as const satisfies readonly (keyof ValidityState & ValidityKind)[];

// The bound as the field words it when a value input said, else the control's own attribute.
function bound(el: ValidityCarrier, side: 'min' | 'max'): string {
  return valueInputs.get(el)?.bound[side] ?? (el as Partial<HTMLInputElement>)[side] ?? '';
}

// Dates and times read "or later" and "or earlier", not "or more".
const WHEN_TYPES = ['date', 'time', 'datetime-local'];

function message(el: ValidityCarrier, kind: Exclude<ValidityKind, 'server'>, strings: Strings): string {
  const bounds = el as Partial<HTMLInputElement>;
  switch (kind) {
    case 'valueMissing':
      return strings.valueMissing;
    case 'typeMismatch':
      return bounds.type === 'email'
        ? strings.typeMismatchEmail
        : bounds.type === 'url'
          ? strings.typeMismatchUrl
          : strings.typeMismatch;
    case 'badInput':
      return strings.badInput;
    case 'patternMismatch':
      return strings.patternMismatch;
    case 'tooShort':
      return strings.tooShort(bounds.minLength ?? 0);
    case 'tooLong':
      return strings.tooLong(bounds.maxLength ?? 0);
    case 'rangeUnderflow':
      return WHEN_TYPES.includes(bounds.type ?? '')
        ? strings.dateRangeUnderflow(bound(el, 'min'))
        : strings.rangeUnderflow(bound(el, 'min'));
    case 'rangeOverflow':
      return WHEN_TYPES.includes(bounds.type ?? '')
        ? strings.dateRangeOverflow(bound(el, 'max'))
        : strings.rangeOverflow(bound(el, 'max'));
    case 'stepMismatch':
      return strings.stepMismatch;
    case 'customError':
      // The product's own text, set with setCustomValidity, is never translated.
      return el.validationMessage;
  }
}

/**
 * The first failed flag of the control's `validity`, as Todae's words in the
 * page's language. A `customError` keeps the control's own `validationMessage`.
 * Null when the control is valid or barred from validation.
 */
export function describeValidity(el: ValidityCarrier, strings: Strings): FormFieldError | null {
  if (!el.willValidate || el.validity.valid) return null;
  const kind = FLAGS.find((flag) => el.validity[flag]);
  // A flag this list doesn't know yet still has the browser's text.
  if (!kind) return { kind: 'customError', message: el.validationMessage };
  return { kind, message: message(el, kind, strings) };
}
