import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Fallbacks for when the exit transition can't be read from computed style.
// The real lengths come from the dialog, sheet and drawer motion tokens.
export const DIALOG_EXIT_MS = 160;
export const SHEET_EXIT_MS = 240;
export const DRAWER_EXIT_MS = 240;

function cssTimeMs(value: string): number | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)(ms|s)$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

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

export function useOverlayPresence(
  open: boolean,
  exitMs: number,
  node: HTMLElement | null,
  propertyName: string,
): { present: boolean; exiting: boolean; finishExit: () => void } {
  const [present, setPresent] = useState(open);
  const [exiting, setExiting] = useState(false);
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;

  useLayoutEffect(() => {
    if (open) {
      setPresent(true);
      setExiting(false);
      return;
    }
    if (!present) return;
    if (reducedMotion()) {
      setPresent(false);
      setExiting(false);
      return;
    }
    setExiting(true);
  }, [open, present]);

  const finishExit = useCallback(() => {
    setPresent(false);
    setExiting(false);
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

  return { present, exiting, finishExit };
}
