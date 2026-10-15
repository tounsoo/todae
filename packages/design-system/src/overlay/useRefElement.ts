import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The element `ref` holds, as state, so effects can depend on it. Read after
 * each commit of the calling component, so render the element there.
 */
export function useRefElement<T extends Element>(ref: RefObject<T | null>): T | null {
  const [node, setNode] = useState<T | null>(null);
  // Every commit on purpose: a ref has no change signal, and the element can
  // attach later or be replaced. The updater bails out when it is the same.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const current = ref.current;
    setNode((prev) => (prev === current ? prev : current));
  });
  return node;
}
