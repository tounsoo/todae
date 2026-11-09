// The Tab key press now under way, seen first at the window so stopped
// propagation cannot hide it, and dropped once the browser has moved focus.
// One window listener serves every part that asks, where each Toolbar used
// to add its own: a page of 500 row toolbars ran 500 handlers per keystroke.

let current: KeyboardEvent | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let watchers = 0;

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  current = event;
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
  });
}

/** Starts following Tab presses; the returned stop ends this part's share. */
export function watchTabKey(): () => void {
  if (watchers++ === 0) window.addEventListener('keydown', onKey, true);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--watchers > 0) return;
    window.removeEventListener('keydown', onKey, true);
    clearTimeout(timer);
    current = null;
  };
}

/**
 * Whether the focus now arriving is the browser's own Tab move: a Tab press
 * has finished dispatch unprevented. Focus a handler moves during the key,
 * such as a menu returning focus to its trigger, does not count.
 */
export function isTabbing(): boolean {
  return current !== null && current.eventPhase === Event.NONE && !current.defaultPrevented;
}
