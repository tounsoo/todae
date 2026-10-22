import { useCallback, type RefCallback, type RefObject } from 'react';
import { focusWithoutScroll } from '../components/revealRing.js';
import { getCandidates } from '../overlay/tabbables.js';
import { activeIn, focusLost } from '../components/activeElement.js';

export type UseFocusHandoffOptions = {
  /** The element that takes focus when the watched element unmounts while it holds focus. */
  to: RefObject<HTMLElement | null>;
};

/**
 * Returns a ref for an element that can unmount while it holds focus, such as
 * buttons that go away once they are used. When it unmounts with focus inside,
 * focus moves to `to` once the commit is done, unless something else took
 * focus by then or `to` is gone too. A click on a control inside focuses that
 * control first, since Safari and Firefox on macOS do not focus a clicked button.
 */
export function useFocusHandoff<T extends HTMLElement = HTMLElement>({ to }: UseFocusHandoffOptions): RefCallback<T> {
  return useCallback(
    (el: T | null) => {
      if (!el) return;
      // In the capture phase, so the control has focus before the product's
      // onClick, which may remove the element at once.
      const focusClicked = (event: MouseEvent) => {
        const control = getCandidates(el).find((candidate) => candidate.contains(event.target as Node));
        if (control && activeIn(control) !== control) focusWithoutScroll(control);
      };
      el.addEventListener('click', focusClicked, true);
      // React runs this cleanup before it takes the element out, so focus is
      // still inside it then; the hand-off itself waits until the commit is done.
      return () => {
        el.removeEventListener('click', focusClicked, true);
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
