import { useLayoutEffect, useRef } from 'react';
import type { ValidityCarrier } from './validity.js';

/**
 * Sets `message` as the custom validity of the control `find` returns, after
 * every commit, so a control that remounts or a rule that changes is followed.
 * An empty or missing message clears it. Nothing is touched until a message
 * has been given, so a product's own `setCustomValidity` on a control stays.
 * With `part`, a message that finds no control warns in development, once.
 */
export function useCustomValidity(
  find: () => ValidityCarrier | null | undefined,
  message: string | undefined,
  part?: string,
): void {
  // The control this part last gave a message to.
  const applied = useRef<ValidityCarrier | null>(null);
  const warned = useRef(false);
  useLayoutEffect(() => {
    const carrier = find() ?? null;
    if (process.env.NODE_ENV !== 'production' && part) {
      if (message && !carrier && !warned.current) console.warn(`${part}: customValidity has no control to go on, so it blocks nothing.`);
      warned.current = Boolean(message) && !carrier;
    }
    if (applied.current && applied.current !== carrier) applied.current.setCustomValidity('');
    if (carrier && (message !== undefined || applied.current === carrier)) carrier.setCustomValidity(message ?? '');
    applied.current = carrier && message ? carrier : null;
  });
  useLayoutEffect(
    () => () => {
      applied.current?.setCustomValidity('');
      applied.current = null;
    },
    [],
  );
}
