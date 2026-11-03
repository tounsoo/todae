import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react';
import { focusPath, isElement, isNode } from '../internal/dom.js';

/**
 * Calls `onLeave` when focus leaves the element these handlers sit on, with
 * the element focus landed on. A blur with no relatedTarget (an iframe, the
 * page, another window) is checked once focus settles, and dropped when focus
 * comes back first or the element unmounts. Focus in a frame inside the
 * element still counts as inside, and a window that lost focus keeps its
 * active element, so it is not leaving. `ignore`, read at the blur,
 * drops a leave the owner already knows about.
 */
export function useFocusLeave(onLeave: (next: Element | null) => void, ignore?: () => boolean) {
  const latest = useRef(onLeave);
  const latestIgnore = useRef(ignore);
  useLayoutEffect(() => {
    latest.current = onLeave;
    latestIgnore.current = ignore;
  });
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
  }, []);
  useEffect(() => cancel, [cancel]);
  const onBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget;
      const container = event.currentTarget;
      if (isNode(next) && container.contains(next)) return;
      if (latestIgnore.current?.()) {
        cancel();
        return;
      }
      if (next === null) {
        cancel();
        pending.current = setTimeout(() => {
          pending.current = undefined;
          const path = focusPath(container.ownerDocument);
          if (!path.some((el) => container.contains(el))) latest.current(path.at(-1) ?? null);
        });
        return;
      }
      latest.current(isElement(next) ? next : null);
    },
    [cancel],
  );
  return { onFocus: cancel, onBlur };
}
