import { useEffect, useRef } from 'react';

type Entry = { handle: () => void };

const stack: Entry[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  top.handle();
}

function push(entry: Entry): () => void {
  stack.push(entry);
  if (!listening) {
    document.addEventListener('keydown', onKeyDown);
    listening = true;
  }
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onKeyDown);
      listening = false;
    }
  };
}

/**
 * Calls `handler` on Escape while `active && enabled`. Overlays stack: only the most recently
 * activated one handles the key, so Escape in a popover inside a sheet closes the popover first.
 * Order is activation order. Layers that activate in the same commit register child-first, so
 * open nested overlays one after another rather than together.
 */
export function useEscapeKey(active: boolean, enabled: boolean, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active || !enabled) return;
    return push({ handle: () => handlerRef.current() });
  }, [active, enabled]);
}
