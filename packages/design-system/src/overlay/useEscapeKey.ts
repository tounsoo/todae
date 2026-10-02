import { useEffect, useRef } from 'react';

type Entry = { handle: () => void; enabled: () => boolean };

const stack: Entry[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A disabled layer keeps its place but lets Escape fall through to the next enabled one.
  const top = [...stack].reverse().find((entry) => entry.enabled());
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
  const enabledRef = useRef(enabled);
  handlerRef.current = handler;
  enabledRef.current = enabled;
  // Keyed on `active` only: toggling `enabled` must not move the layer above overlays opened later.
  useEffect(() => {
    if (!active) return;
    return push({ handle: () => handlerRef.current(), enabled: () => enabledRef.current });
  }, [active]);
}
