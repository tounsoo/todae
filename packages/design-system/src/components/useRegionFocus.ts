import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { matchesParsed, parseHotkey, typesIn } from '../hooks/hotkey.js';
import { handledInside, useEscapeKey } from '../overlay/useEscapeKey.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { initialFocusTarget } from '../overlay/useInitialFocus.js';
import { tryFocus } from '../overlay/useToastHost.js';
import { alongside } from '../internal/props.js';
import type { Toaster } from './toaster.js';

/**
 * Keyboard focus, as opposed to focus a pointer press left behind. Only
 * keyboard focus pauses the toasts; the pointer pauses them by hovering, a
 * finger by pressing or tapping.
 */
export function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

type RegionFocusOptions<T extends object> = {
  sectionRef: RefObject<HTMLElement | null>;
  toaster: Toaster<T>;
  /** How many toasts show at once. */
  max: number;
  hotkey: string | null;
  hasOpen: boolean;
  onFocus?: ((event: FocusEvent<HTMLElement>) => void) | undefined;
  onBlur?: ((event: FocusEvent<HTMLElement>) => void) | undefined;
};

/**
 * Focus in the toast region: where it came from, to go back to, the hotkey
 * that moves it in, and where it goes when it leaves. `focused` is keyboard
 * focus inside, which spreads the stack and holds the timers; `inside` is any
 * focus inside, while which the region and its toasts are layers on the
 * Escape stack. Escape on the region itself leaves it. `whileMoving`
 * runs a move of the region's host, whose focus events don't count as focus
 * coming in, and `lastInside` is what to focus again if the host left the
 * document with focus inside.
 */
export function useRegionFocus<T extends object>({
  sectionRef,
  toaster,
  max,
  hotkey,
  hasOpen,
  onFocus,
  onBlur,
}: RegionFocusOptions<T>) {
  const [focused, setFocused] = useState(false);
  // Focus anywhere inside, from a pointer too. The region's Escape layers
  // join the stack when focus comes in, so overlays shown before that don't
  // take Escape from them.
  const [inside, setInside] = useState(false);
  // Where focus came from into the region, to go back to. Never inside it.
  const origin = useRef<HTMLElement | null>(null);
  const lastInside = useRef<HTMLElement | null>(null);
  const moving = useRef(false);
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const whileMoving = useCallback((change: () => void) => {
    moving.current = true;
    try {
      change();
    } finally {
      moving.current = false;
    }
  }, []);

  // Focus can leave without a blur, such as when the focused element is
  // removed or moved, so it is read again after those.
  const syncFocused = useCallback(() => {
    const section = sectionRef.current;
    const active = section?.ownerDocument.activeElement;
    const within = Boolean(active && section.contains(active));
    setInside(within);
    setFocused(within && isKeyboardFocus(active!));
  }, [sectionRef]);

  // Focus leaves the region: back where it came from, else to the modal the
  // region sits in (the host's parent), as the page outside it is inert,
  // else out of the region rather than lost with an element about to be
  // removed.
  const leave = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const from = origin.current;
    origin.current = null;
    const active = section.ownerDocument.activeElement;
    const container = section.parentElement?.parentElement;
    const modal = container instanceof HTMLDialogElement ? container : null;
    if (!tryFocus(from) && !(modal && tryFocus(initialFocusTarget(modal)))) {
      if (active instanceof HTMLElement && section.contains(active)) active.blur();
    }
    syncFocused();
  }, [sectionRef, syncFocused]);

  // A focused toast is leaving. A keyboard user stays in the region while
  // other toasts remain, so the next Tab reaches them; otherwise focus leaves.
  const afterFocusLost = useCallback(
    (keyboard: boolean) => {
      if (!alive.current) return;
      const others = toaster.getSnapshot().slice(0, max).some((toast) => toast.open);
      if (keyboard && others) sectionRef.current?.focus();
      else leave();
    },
    [toaster, max, leave, sectionRef],
  );

  // Escape on the region itself, where the hotkey and a keyboard user whose
  // toast left put focus. A toast takes Escape inside it.
  useEscapeKey(inside, (target) => target !== null && target === sectionRef.current, leave, sectionRef, {
    closeRequests: false,
    passesKey: handledInside,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && hotkey && !parseHotkey(hotkey)) {
      console.error(`Todae: Toast.Region hotkey "${hotkey}" isn't one it can read, so it is off.`);
    }
  }, [hotkey]);

  useEffect(() => {
    const parsed = hotkey ? parseHotkey(hotkey) : null;
    const doc = sectionRef.current?.ownerDocument;
    if (!parsed || !hasOpen || !doc) return;
    const onKey = (event: KeyboardEvent) => {
      const section = sectionRef.current;
      // Not a key something else handled, an IME composing, or a held key.
      if (event.defaultPrevented || event.isComposing || event.repeat || typesIn(event.target, parsed)) return;
      // The key stays the page's when the region can't take focus, such as
      // under a modal outside Todae's stack.
      if (section && matchesParsed(event, parsed) && tryFocus(section)) event.preventDefault();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [hotkey, hasOpen, sectionRef]);

  // Not when the host left the document with focus inside: the host's move
  // puts it back and focuses that element again.
  const focusLeave = useFocusLeave(
    () => {
      origin.current = null;
      lastInside.current = null;
      setInside(false);
      setFocused(false);
    },
    // Nor while Todae moves or shows the host again, which puts focus back.
    () => moving.current || !sectionRef.current?.isConnected,
  );

  const handlers = {
    onFocus: alongside(onFocus, (event: FocusEvent<HTMLElement>) => {
      focusLeave.onFocus();
      setInside(true);
      if (event.target instanceof HTMLElement) lastInside.current = event.target;
      if (moving.current) return;
      const from = event.relatedTarget;
      // Only from outside: focus moving within the region keeps the origin,
      // and an unknown origin keeps the last one.
      if (from instanceof HTMLElement && !event.currentTarget.contains(from)) origin.current = from;
      setFocused(isKeyboardFocus(event.target));
    }),
    onBlur: alongside(onBlur, focusLeave.onBlur),
  };

  return { focused, inside, syncFocused, whileMoving, lastInside, afterFocusLost, handlers };
}
