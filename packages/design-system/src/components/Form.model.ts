import type { Strings } from '../providers/strings.js';
import type { Dismissal, FormErrors, Reading, SummaryEntry } from './Form.context.js';
import { describeValidity, focusTargetFor, isValidityCarrier, reachTarget, type FormFieldError, type ValidityCarrier } from './validity.js';

export const SCOPE_ATTRIBUTE = 'data-todae-validation-scope';
export const SCOPE_SELECTOR = '[data-todae-validation-scope]';

/** The server error for a name, unless the person has edited since that very text arrived. An empty text is none. */
export function serverErrorFor(name: string, errors: FormErrors | undefined, dismissal: Dismissal): string | undefined {
  const text = name ? errors?.[name] : undefined;
  if (!text) return undefined;
  return dismissal.get(name) === text ? undefined : text;
}

/**
 * What a scope shows: the first server error, in document order, that no edit
 * has hidden, since the server knows what the browser can't and needs no
 * reveal; else, once the scope is revealed, the first native problem.
 */
export function pickShown(
  readings: readonly Reading[],
  errors: FormErrors | undefined,
  dismissal: Dismissal,
  revealed: boolean,
): { reading: Reading; error: FormFieldError } | null {
  for (const reading of readings) {
    const server = serverErrorFor(reading.name, errors, dismissal);
    if (server === undefined) continue;
    // The error is the name's: of the controls that share it (a radio group), the person can only reach an enabled one.
    const reachable = reading.disabled ? (readings.find((other) => other.name === reading.name && !other.disabled) ?? reading) : reading;
    return { reading: reachable, error: { kind: 'server', message: server } };
  }
  if (revealed) {
    for (const reading of readings) if (reading.native) return { reading, error: reading.native };
  }
  return null;
}

export function sameReading(a: Reading, b: Reading): boolean {
  return (
    a.carrier === b.carrier &&
    a.name === b.name &&
    a.label === b.label &&
    a.id === b.id &&
    a.disabled === b.disabled &&
    a.native?.kind === b.native?.kind &&
    a.native?.message === b.native?.message
  );
}

export function sameReadings(a: readonly Reading[], b: readonly Reading[]): boolean {
  return a.length === b.length && a.every((reading, i) => b[i] !== undefined && sameReading(reading, b[i]));
}

/**
 * The form controls inside `root`. `own` keeps those whose nearest scope is
 * `root`, not those of a scope inside it. A control takes part when it
 * validates, or, with `named`, when it has a name, since a server error is for
 * a name.
 */
export function carriersIn(root: Element, { own, named = false }: { own: boolean; named?: boolean }): ValidityCarrier[] {
  return [...root.querySelectorAll('input, select, textarea')].filter(
    (node): node is ValidityCarrier =>
      isValidityCarrier(node) && (node.willValidate || (named && Boolean(node.name))) && (!own || node.closest(SCOPE_SELECTOR) === root),
  );
}

const EMPTY_KEY = '[]';

/** What `errors` says, apart from which object says it: its non-empty entries by name. */
export function errorsKey(errors: FormErrors | undefined): string {
  const entries = Object.entries(errors ?? {}).filter(([, text]) => text);
  if (entries.length === 0) return EMPTY_KEY;
  return JSON.stringify(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Whether a refresh would leave an entry as it is. */
export function sameEntry(a: SummaryEntry, b: SummaryEntry): boolean {
  return a.scopeId === b.scopeId && a.error.kind === b.error.kind && a.error.message === b.error.message && sameReading(a.reading, b.reading);
}

/** The controls some scope of `form` reads: the ones a scope can show. */
export function scopedControls(form: Element): Set<Element> {
  const read = new Set<Element>();
  for (const scope of form.querySelectorAll(SCOPE_SELECTOR)) for (const control of carriersIn(scope, { own: true, named: true })) read.add(control);
  return read;
}

export const keyHasErrors = (key: string) => key !== EMPTY_KEY;

function textOf(ids: string | null, from: Element): string {
  return (ids ?? '')
    .split(/\s+/)
    .map((id) => (id ? from.ownerDocument.getElementById(id)?.textContent?.trim() : undefined))
    .filter(Boolean)
    .join(' ');
}

/** Names a control for a person: its fieldset's legend, a radio group's name, its label, then `aria-labelledby` and `aria-label`. */
export function labelOf(carrier: ValidityCarrier, scope: Element): string {
  if (scope instanceof HTMLFieldSetElement) {
    const legend = scope.querySelector(':scope > legend')?.textContent?.trim();
    if (legend) return legend;
  }
  const group = carrier instanceof HTMLInputElement && carrier.type === 'radio' ? carrier.closest('[role="radiogroup"]') : null;
  // A value input has no label of its own: its field's control has.
  const from = group ?? focusTargetFor(carrier);
  const label = group ? '' : (from as Partial<HTMLInputElement>).labels?.[0]?.textContent?.trim();
  return label || textOf(from.getAttribute('aria-labelledby'), from) || from.getAttribute('aria-label') || carrier.name;
}

/** What a scope's controls say now. */
export function readScope(scope: Element, strings: Strings): Reading[] {
  return carriersIn(scope, { own: true, named: true }).map((carrier) => {
    // A value input is not what a person reaches: its field's control is.
    const { target, disabled } = reachTarget(carrier);
    return { carrier, name: carrier.name, native: describeValidity(carrier, strings), label: labelOf(carrier, scope), id: target.id, disabled };
  });
}

/**
 * The scopes of a form that show an error, read from the page itself, in
 * document order of their controls. `native` says whether a control's own
 * problem counts, or only a server error.
 */
export function failingEntries(
  form: Element,
  errors: FormErrors | undefined,
  dismissal: Dismissal,
  strings: Strings,
  native: boolean,
): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  for (const scope of form.querySelectorAll(SCOPE_SELECTOR)) {
    const shown = pickShown(readScope(scope, strings), errors, dismissal, native);
    if (shown) {
      entries.push({ scopeId: scope.getAttribute(SCOPE_ATTRIBUTE) ?? '', error: shown.error, reading: shown.reading });
    }
  }
  return entries.sort((a, b) => (a.reading.carrier.compareDocumentPosition(b.reading.carrier) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}
