import type { Strings } from '../providers/strings.js';
import type { Dismissal, FormErrors, Reading, SummaryEntry } from './Form.context.js';
import { describeValidity, isValidityCarrier, type FormFieldError, type ValidityCarrier } from './validity.js';

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
    if (server !== undefined) return { reading, error: { kind: 'server', message: server } };
  }
  if (revealed) {
    for (const reading of readings) if (reading.native) return { reading, error: reading.native };
  }
  return null;
}

export function sameReadings(a: readonly Reading[], b: readonly Reading[]): boolean {
  return (
    a.length === b.length &&
    a.every((reading, i) => {
      const other = b[i];
      return (
        other !== undefined &&
        reading.carrier === other.carrier &&
        reading.name === other.name &&
        reading.label === other.label &&
        reading.native?.kind === other.native?.kind &&
        reading.native?.message === other.native?.message
      );
    })
  );
}

/** The controls whose nearest scope is `scope`: not those of a scope inside it. */
function ownControls(scope: Element): ValidityCarrier[] {
  return [...scope.querySelectorAll('input, select, textarea')].filter(
    (node): node is ValidityCarrier => isValidityCarrier(node) && node.closest(SCOPE_SELECTOR) === scope,
  );
}

/** The controls that take part in validation, whose native problems the scope shows. */
export function scopeCarriers(scope: Element): ValidityCarrier[] {
  return ownControls(scope).filter((node) => node.willValidate);
}

/** Every named control, validating or not, since a server error is for a name. */
export function scopeControls(scope: Element): ValidityCarrier[] {
  return ownControls(scope).filter((node) => node.willValidate || node.name);
}

/** The first control at any depth inside `root` that takes part in validation. */
export function firstCarrier(root: Element): ValidityCarrier | undefined {
  return [...root.querySelectorAll('input, select, textarea')].find(
    (node): node is ValidityCarrier => isValidityCarrier(node) && node.willValidate,
  );
}

const EMPTY_KEY = '[]';

/** What `errors` says, apart from which object says it: its non-empty entries by name. */
export function errorsKey(errors: FormErrors | undefined): string {
  const entries = Object.entries(errors ?? {}).filter(([, text]) => text);
  if (entries.length === 0) return EMPTY_KEY;
  return JSON.stringify(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export const hasEntries = (key: string) => key !== EMPTY_KEY;

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
  const from = group ?? carrier;
  const label = group ? '' : carrier.labels?.[0]?.textContent?.trim();
  return label || textOf(from.getAttribute('aria-labelledby'), from) || from.getAttribute('aria-label') || carrier.name;
}

/** What a scope's controls say now. */
export function readScope(scope: Element, strings: Strings): Reading[] {
  return scopeControls(scope).map((carrier) => ({
    carrier,
    name: carrier.name,
    native: describeValidity(carrier, strings),
    label: labelOf(carrier, scope),
  }));
}

/**
 * The scopes of a form that show an error with every scope revealed, read
 * from the page itself, in document order of their controls. With `only`, just
 * those scopes.
 */
export function failingEntries(
  form: Element,
  errors: FormErrors | undefined,
  dismissal: Dismissal,
  strings: Strings,
  only?: ReadonlySet<string>,
): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  for (const scope of form.querySelectorAll(SCOPE_SELECTOR)) {
    const scopeId = scope.getAttribute(SCOPE_ATTRIBUTE) ?? '';
    if (only && !only.has(scopeId)) continue;
    const shown = pickShown(readScope(scope, strings), errors, dismissal, true);
    if (shown) entries.push({ scopeId, error: shown.error, label: shown.reading.label, carrier: shown.reading.carrier });
  }
  return entries.sort((a, b) => (a.carrier.compareDocumentPosition(b.carrier) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}
