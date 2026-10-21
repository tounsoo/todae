import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ValidityCarrier } from './validity.js';

/** For each control, the message of each part that owns a say in it, by the part's element. */
const owners = new WeakMap<ValidityCarrier, Map<Element, string>>();

/** A control has one custom validity: the first non-empty message, innermost owner first. */
function settle(carrier: ValidityCarrier) {
  const messages = [...(owners.get(carrier) ?? [])].filter(([, message]) => message);
  // Every owner encloses the control, so they nest.
  messages.sort(([a], [b]) => (a === b ? 0 : a.contains(b) ? 1 : -1));
  carrier.setCustomValidity(messages[0]?.[1] ?? '');
}

function release(carrier: ValidityCarrier, owner: Element) {
  if (owners.get(carrier)?.delete(owner)) settle(carrier);
}

/**
 * Gives `message` to the control `find` returns, after every commit, so a
 * control that remounts or a rule that changes is followed. Parts that share a
 * control (a Fieldset around a Field.Root) don't clobber each other: the
 * control's own part wins, then each fieldset outward. An empty message holds
 * nothing back. Nothing is touched until a message has been given, so a
 * product's own `setCustomValidity` on a control stays. With `part`, a message
 * that finds no control warns in development, once.
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
    if (prev && (prev.carrier !== carrier || prev.owner !== element || message === undefined)) {
      release(prev.carrier, prev.owner);
      held.current = null;
    }
    if (!carrier || !element || message === undefined) return;
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
