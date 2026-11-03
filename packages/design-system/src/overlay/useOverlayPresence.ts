import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cssTimeMs } from './cssTime.js';

// Fallbacks for when the exit transition can't be read from computed style.
// The real lengths come from the dialog, sheet and drawer motion tokens.
export const DIALOG_EXIT_MS = 160;
export const SHEET_EXIT_MS = 240;
export const DRAWER_EXIT_MS = 240;

/** Duration plus delay of `propertyName`'s computed transition, or null when none applies. */
export function transitionMs(node: Element, propertyName: string): number | null {
  const style = getComputedStyle(node);
  const split = (value: string) => value.split(',').map((part) => part.trim());
  const properties = split(style.transitionProperty);
  const durations = split(style.transitionDuration);
  const delays = split(style.transitionDelay);
  if (!style.transitionDuration) return null;
  let index = properties.lastIndexOf(propertyName);
  if (index < 0) index = properties.lastIndexOf('all');
  if (index < 0) return null;
  // Shorter duration and delay lists repeat to cover every property.
  const duration = cssTimeMs(durations[index % durations.length] ?? '');
  const delay = cssTimeMs(delays[index % delays.length] ?? '0s') ?? 0;
  return duration === null ? null : Math.max(0, duration) + Math.max(0, delay);
}

export function reducedMotion(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

export function isExitTransition(
  event: {
    target: EventTarget | null;
    currentTarget: EventTarget | null;
    propertyName?: string;
    nativeEvent?: { propertyName?: string };
  },
  propertyName: string,
): boolean {
  if (event.currentTarget && event.target && event.target !== event.currentTarget) return false;
  const name = event.propertyName || event.nativeEvent?.propertyName;
  return !name || name === propertyName;
}

export function useEntered(present: boolean, exiting: boolean): boolean {
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    if (!present) {
      setEntered(false);
      return;
    }
    if (exiting) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setEntered(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [exiting, present]);
  return entered;
}

/** `onExited` runs once as an exit ends, in the update that turns `present` false, and not when an unmount cuts the exit short. */
export function useOverlayPresence(
  open: boolean,
  exitMs: number,
  node: HTMLElement | null,
  propertyName: string,
  onExited?: () => void,
): { present: boolean; exiting: boolean } {
  const [present, setPresent] = useState(open);
  const [exiting, setExiting] = useState(false);
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useLayoutEffect(() => {
    if (open) {
      setPresent(true);
      setExiting(false);
      return;
    }
    if (!present) return;
    // Under reduced motion an overlay may still fade out; finish at once only
    // when it has no transition for the exit to wait on.
    if (reducedMotion() && !(node && transitionMs(node, propertyName))) {
      setPresent(false);
      setExiting(false);
      onExitedRef.current?.();
      return;
    }
    setExiting(true);
  }, [node, open, present, propertyName]);

  const finishExit = useCallback(() => {
    if (!exitingRef.current) return;
    exitingRef.current = false;
    setPresent(false);
    setExiting(false);
    onExitedRef.current?.();
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const ms = (node && transitionMs(node, propertyName)) ?? exitMs;
    const id = window.setTimeout(finishExit, ms);
    return () => window.clearTimeout(id);
  }, [exiting, exitMs, finishExit, node, propertyName]);

  useLayoutEffect(() => {
    if (!node) return;
    let armed = !exiting;
    let raf = 0;
    if (exiting) {
      raf = requestAnimationFrame(() => {
        armed = true;
      });
    }
    const onEnd = (event: Event) => {
      if (!exitingRef.current || !armed) return;
      if (isExitTransition(event, propertyName)) finishExit();
    };
    node.addEventListener('transitionend', onEnd);
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener('transitionend', onEnd);
    };
  }, [exiting, finishExit, node, propertyName]);

  return { present, exiting };
}

/**
 * Calls `onExited` once `node`'s exit transition of `propertyName` ends, at
 * once when it has none, or as its computed duration runs out if no end
 * event comes. For an element that stays mounted, such as a popover, whose
 * closed state is already applied. Returns a cancel.
 */
export function whenExited(node: HTMLElement | null, propertyName: string, onExited: () => void): () => void {
  const ms = node ? transitionMs(node, propertyName) : null;
  if (!node || !ms) {
    onExited();
    return () => undefined;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancel();
    onExited();
  };
  const onEnd = (event: Event) => {
    if (isExitTransition(event, propertyName)) finish();
  };
  const id = window.setTimeout(finish, ms);
  const cancel = () => {
    done = true;
    window.clearTimeout(id);
    node.removeEventListener('transitionend', onEnd);
  };
  node.addEventListener('transitionend', onEnd);
  return cancel;
}
