import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onReset` after a reset of the form that owns the input at `ref`, or an
 * input inside it, unless a handler cancelled the reset. Those handlers run
 * after this listener, and after a microtask too, so it waits a task. `reset`
 * is not composed, so the listener sits on the element's root node, a document
 * or a shadow root. `onReset` is read when it runs.
 */
export function useFormReset(ref: RefObject<Element | null>, onReset: () => void): void {
  const latest = useRef(onReset);
  useLayoutEffect(() => {
    latest.current = onReset;
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = element.getRootNode();
    const listener = (event: Event) => {
      if (!resetsInputOf(event.target, element)) return;
      window.setTimeout(() => {
        if (!event.defaultPrevented) latest.current();
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
