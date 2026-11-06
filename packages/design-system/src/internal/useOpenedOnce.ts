import { useState } from 'react';

/**
 * True from the render where `open` first turns true, and from then on. An
 * overlay that mounts its content only once it has opened uses it: a page can
 * hold hundreds of closed menus and popovers, and one that never opens should
 * cost no content. Content stays after the first open, so the exit motion has
 * something to fade and uncontrolled content keeps its state.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
