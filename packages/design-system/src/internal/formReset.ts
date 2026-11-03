import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onReset` after a reset of the form that owns the input at `ref`, or an
 * input inside it, unless a handler cancelled the reset. Those handlers run
 * after this listener, and after a microtask too, so it waits a task. `reset`
 * is not composed, so the listener sits on the element's root node, a document
 * or a shadow root. `onReset` gets what `read` returned when the reset began,
 * before any handler ran. Both are read when they run.
 */
export function useFormReset<T>(ref: RefObject<Element | null>, onReset: (atReset: T) => void, read: () => T): void {
  const latest = useRef({ onReset, read });
  useLayoutEffect(() => {
    latest.current = { onReset, read };
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = element.getRootNode();
    const listener = (event: Event) => {
      if (!resetsInputOf(event.target, element)) return;
      const atReset = latest.current.read();
      window.setTimeout(() => {
        if (!event.defaultPrevented) latest.current.onReset(atReset);
      });
    };
    root.addEventListener('reset', listener, true);
    return () => root.removeEventListener('reset', listener, true);
  }, [ref]);
}

function resetsInputOf(form: EventTarget | null, element: Element) {
  const inputs = [element, ...element.querySelectorAll('input')] as HTMLInputElement[];
  return inputs.some((input) => input.form === form);
}
