import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const DIALOG_EXIT_MS = 160;
export const SHEET_EXIT_MS = 240;

function reducedMotion(): boolean {
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
    const id = window.setTimeout(finishExit, exitMs);
    return () => window.clearTimeout(id);
  }, [exiting, exitMs, finishExit]);

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
