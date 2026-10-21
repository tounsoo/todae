import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ValidityCarrier } from './validity.js';

/** For each control, the message of each part that owns a say in it, by the part's element. */
const owners = new WeakMap<ValidityCarrier, Map<Element, string>>();

/** The message Todae last wrote to each control, so only that is ever cleared. */
const written = new WeakMap<ValidityCarrier, string>();

/** A control has one custom validity: the first non-empty message, innermost owner first. It is written only when it changes. */
function settle(carrier: ValidityCarrier) {
  const messages = [...(owners.get(carrier) ?? [])];
  // Every owner encloses the control, so they nest.
  messages.sort(([a], [b]) => (a === b ? 0 : a.contains(b) ? 1 : -1));
  const winner = messages[0]?.[1] ?? '';
  // Look at the element, not at what was written: a product may have changed its message since.
  const current = carrier.validity.customError ? carrier.validationMessage : '';
  if (winner) {
    if (current !== winner) carrier.setCustomValidity(winner);
    written.set(carrier, winner);
    return;
  }
  // Clear only what Todae wrote and the element still holds.
  const wrote = written.get(carrier);
  if (wrote !== undefined && current === wrote) carrier.setCustomValidity('');
  written.delete(carrier);
}

function release(carrier: ValidityCarrier, owner: Element) {
  if (owners.get(carrier)?.delete(owner)) settle(carrier);
}

/**
 * Gives `message` to the control `find` returns, after every commit, so a
 * control that remounts or a rule that changes is followed. Parts that share a
 * control (a Fieldset around a Field.Root) don't clobber each other: the
 * control's own part wins, then each fieldset outward. An empty message is no
 * rule, as is none. Todae writes only when its message changes, and clears only
 * what it wrote, so a product's own `setCustomValidity` on a control stays.
 * With `part`, a message that finds no control warns in development, once.
 */
export function useCustomValidity(
  owner: RefObject<Element | null>,
  find: () => ValidityCarrier | null | undefined,
  message: string | undefined,
  part?: string,
): void {
  const held = useRef<{ carrier: ValidityCarrier; owner: Element } | null>(null);
  const warned = useRef(false);
  useLayoutEffect(() => {
    const carrier = find() ?? null;
    const element = owner.current;
    if (process.env.NODE_ENV !== 'production' && part) {
      if (message && !carrier && !warned.current) console.warn(`${part}: customValidity has no control to go on, so it blocks nothing.`);
      warned.current = Boolean(message) && !carrier;
    }
    const prev = held.current;
    if (prev && (prev.carrier !== carrier || prev.owner !== element || !message)) {
      release(prev.carrier, prev.owner);
      held.current = null;
    }
    if (!carrier || !element || !message) return;
    const messages = owners.get(carrier) ?? new Map<Element, string>();
    owners.set(carrier, messages.set(element, message));
    settle(carrier);
    held.current = { carrier, owner: element };
  });
  useLayoutEffect(
    () => () => {
      if (held.current) release(held.current.carrier, held.current.owner);
      held.current = null;
    },
    [],
  );
}
