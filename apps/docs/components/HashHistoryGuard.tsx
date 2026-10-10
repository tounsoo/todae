'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Whether Back or Forward reached a history entry Next did not add, such as the one a plain
 * hash link adds, on another page than the one shown. Next ignores those, so the URL would change
 * and the page would not. Entries Next adds always carry a state.
 */
export function landsOnUnroutedPage(state: unknown, url: string, shownPath: string) {
  return state === null && new URL(url).pathname !== shownPath;
}

const reloadPage = () => window.location.reload();

/** Loads the page in full when Back or Forward lands where Next would leave the old page on screen. */
export function HashHistoryGuard({ reload = reloadPage }: { reload?: () => void }) {
  // Null outside the app router, such as in a component test.
  const path = usePathname() ?? '/';
  const shown = useRef(path);
  useEffect(() => {
    shown.current = path;
  }, [path]);
  useEffect(() => {
    // history.state, not the event's: a repeated click on the same hash link fires popstate with no state
    // while its entry keeps Next's.
    const onPopState = () => {
      if (landsOnUnroutedPage(window.history.state, window.location.href, shown.current)) reload();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [reload]);
  return null;
}
