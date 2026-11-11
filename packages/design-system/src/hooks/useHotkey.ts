import { useEffect, useRef } from 'react';
import { matchesParsed, parseHotkey, typesIn, type Hotkey } from './hotkey.js';

export type UseHotkeyOptions = {
  /** Listen only while true. */
  enabled?: boolean;
};

/**
 * Runs `handler` when a key on the page matches `hotkey`, such as "Control+K",
 * or any one of a list. A match is prevented, so the browser's own shortcut
 * does not also run.
 */
export function useHotkey(
  hotkey: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const { enabled = true } = options;
  // Read at key time, so an inline handler never resubscribes.
  const latest = useRef(handler);
  latest.current = handler;
  // A list written inline is a new array each render; its text is what matters.
  const key = JSON.stringify(typeof hotkey === 'string' ? [hotkey] : hotkey);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    for (const each of JSON.parse(key) as string[]) {
      if (!parseHotkey(each)) console.error(`Todae: useHotkey hotkey "${each}" isn't one it can read, so it is off.`);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const hotkeys = (JSON.parse(key) as string[]).map(parseHotkey).filter((parsed): parsed is Hotkey => parsed !== null);
    if (hotkeys.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      // Not a key something else handled, an IME composing, or a held key.
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const match = hotkeys.some((parsed) => matchesParsed(event, parsed) && !typesIn(event.target, parsed));
      if (!match) return;
      event.preventDefault();
      latest.current(event);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, key]);
}
