// The Tab key press now under way, seen first at the window so stopped
// propagation cannot hide it, and dropped once the browser has moved focus.
// One window listener serves every part that asks, where each Toolbar used
// to add its own: a page of 500 row toolbars ran 500 handlers per keystroke.

let current: KeyboardEvent | null = null;
// Counts the presses seen, so a watch can tell one that began after it
// started, even when a page dispatches the same event object again.
let presses = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let watchers = 0;

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  current = event;
  presses++;
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
  });
}

export type TabWatch = {
  /**
   * Whether the focus now arriving is the browser's own Tab move: a Tab
   * press has finished dispatch unprevented. Focus a handler moves during
   * the key, such as a menu returning focus to its trigger, does not count,
   * and neither does a press already under way when this watch started,
   * which a listener of the part's own would not have heard.
   */
  tabbing(): boolean;
  /** Ends this part's share; a second call does nothing. */
  stop(): void;
};

/** Starts following Tab presses for one part. */
export function watchTabKey(): TabWatch {
  if (watchers++ === 0) window.addEventListener('keydown', onKey, true);
  // The first press this watch hears is the next one to reach the shared
  // listener, unless a Tab press is still in an earlier window listener and
  // has not reached it yet: a listener of the part's own, added now, would
  // not have heard that one either.
  const pending = window.event;
  const late =
    pending instanceof KeyboardEvent && pending.type === 'keydown' && pending.key === 'Tab' && pending !== current;
  const first = presses + (late ? 2 : 1);
  let stopped = false;
  return {
    tabbing: () =>
      !stopped &&
      current !== null &&
      presses >= first &&
      current.eventPhase === Event.NONE &&
      !current.defaultPrevented,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (--watchers > 0) return;
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      current = null;
    },
  };
}
