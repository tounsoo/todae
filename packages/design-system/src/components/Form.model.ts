import type { Dismissal, FormErrors, Reading } from './Form.context.js';
import { isValidityCarrier, type FormFieldError, type ValidityCarrier } from './validity.js';

export const SCOPE_SELECTOR = '[data-todae-validation-scope]';

/** The server error for a name that an edit hasn't hidden. An empty text is none. */
export function serverErrorFor(name: string, errors: FormErrors | undefined, dismissal: Dismissal): string | undefined {
  const text = name ? errors?.[name] : undefined;
  if (!text) return undefined;
  return dismissal.errors === errors && dismissal.names.has(name) ? undefined : text;
}

/**
 * What a scope shows: the first control, in document order, with a server
 * error that no edit has hidden, or, once the scope is revealed, a native one.
 * A server error needs no reveal: it only arrives after a submit.
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
    if (revealed && reading.native) return { reading, error: reading.native };
  }
  return null;
}

export function sameReadings(a: readonly Reading[], b: readonly Reading[]): boolean {
  return (
    a.length === b.length &&
    a.every((reading, i) => {
      const other = b[i]!;
      return (
        reading.carrier === other.carrier &&
        reading.name === other.name &&
        reading.label === other.label &&
        reading.native?.kind === other.native?.kind &&
        reading.native?.message === other.native?.message
      );
    })
  );
}

/** The controls a scope answers for: its own, not those of a scope inside it, and only those that take part in validation. */
export function scopeCarriers(scope: Element): ValidityCarrier[] {
  return [...scope.querySelectorAll('input, select, textarea')].filter(
    (node): node is ValidityCarrier =>
      isValidityCarrier(node) && node.willValidate && node.closest(SCOPE_SELECTOR) === scope,
  );
}

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
