import { useLayoutEffect, useRef, type RefObject } from 'react';

type Watch = { el: Element; observer: MutationObserver | null };

/**
 * Calls `onChange` when the element in `ref` mounts or is replaced, and when
 * it or its subtree changes as `options` describes. A change made by a commit
 * is handled in that commit's layout phase, before paint; a commit that leaves
 * the element as it was costs one `takeRecords()` and calls nothing. A change
 * made outside a render, such as a child's own state, comes through the
 * observer. Without `MutationObserver`, every commit calls `onChange`.
 */
export function useDomChange(ref: RefObject<Element | null>, onChange: () => void, options: MutationObserverInit): void {
  const latest = useRef(onChange);
  const watch = useRef<Watch | null>(null);

  useLayoutEffect(() => {
    latest.current = onChange;
    const el = ref.current;
    const current = watch.current;
    if (current?.el === el) {
      if (current.observer && current.observer.takeRecords().length === 0) return;
    } else {
      current?.observer?.disconnect();
      watch.current = null;
      if (!el) return;
      const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => latest.current());
      observer?.observe(el, options);
      watch.current = { el, observer };
    }
    onChange();
  });

  useLayoutEffect(
    () => () => {
      watch.current?.observer?.disconnect();
      watch.current = null;
    },
    [],
  );
}
