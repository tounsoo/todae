import { useCallback, type RefCallback, type RefObject } from 'react';
import { activeIn, focusLost } from './activeElement.js';

export type UseFocusHandoffOptions = {
  /** The element that takes focus when the watched element unmounts while it holds focus. */
  to: RefObject<HTMLElement | null>;
};

/**
 * Returns a ref for an element that can unmount while it holds focus, such as
 * buttons that go away once they are used. When it unmounts with focus inside,
 * focus moves to `to` once the commit is done, unless something else took
 * focus by then or `to` is gone too.
 */
export function useFocusHandoff<T extends HTMLElement = HTMLElement>({ to }: UseFocusHandoffOptions): RefCallback<T> {
  return useCallback(
    (el: T | null) => {
      if (!el) return;
      // React runs this cleanup before it takes the element out, so focus is
      // still inside it then; the hand-off itself waits until the commit is done.
      return () => {
        if (!el.contains(activeIn(el))) return;
        const doc = el.ownerDocument;
        queueMicrotask(() => {
          // Still there: a StrictMode check, a new ref, or a hidden Activity tree.
          if (el.isConnected || !focusLost(doc)) return;
          const target = to.current;
          if (target?.isConnected) target.focus();
        });
      };
    },
    [to],
  );
}
