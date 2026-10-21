import type { RefObject } from 'react';
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

/** Written by a value input, so a bound reads in the field's own format, such as "Oct 7, 2026" for 2026-10-07. */
export const boundText = /* @__PURE__ */ new WeakMap<ValidityCarrier, (raw: string) => string>();

// For each value input, the ref of its field's visible control: the carrier is hidden, so focus goes there.
const valueInputOwners = /* @__PURE__ */ new WeakMap<ValidityCarrier, RefObject<HTMLElement | null>>();

/** Makes `el` a value input of the control `owner` points at, as useField's getValueInputProps does. */
export function registerValueInput(el: ValidityCarrier, owner: RefObject<HTMLElement | null>): void {
  valueInputOwners.set(el, owner);
}

/** The element focus goes to for a control: its field's visible control for a value input, else itself. */
export function focusTargetFor(el: ValidityCarrier): HTMLElement {
  return valueInputOwners.get(el)?.current ?? el;
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

function bound(el: ValidityCarrier, raw: string | undefined): string {
  return boundText.get(el)?.(raw ?? '') ?? raw ?? '';
}

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
      return strings.rangeUnderflow(bound(el, bounds.min));
    case 'rangeOverflow':
      return strings.rangeOverflow(bound(el, bounds.max));
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
