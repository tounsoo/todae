import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react';

/**
 * Calls `onLeave` when focus leaves the element these handlers sit on, with
 * the element focus landed on. A blur with no relatedTarget (an iframe, the
 * page, another window) is checked once focus settles, and dropped when focus
 * comes back first or the element unmounts. A window that lost focus keeps
 * its active element, so it is not leaving. `ignore`, read at the blur,
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
      if (next instanceof Node && container.contains(next)) return;
      if (latestIgnore.current?.()) {
        cancel();
        return;
      }
      if (next === null) {
        cancel();
        pending.current = setTimeout(() => {
          pending.current = undefined;
          const active = document.activeElement;
          if (!container.contains(active)) latest.current(active);
        });
        return;
      }
      latest.current(next instanceof Element ? next : null);
    },
    [cancel],
  );
  return { onFocus: cancel, onBlur };
}
