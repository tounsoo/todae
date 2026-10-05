import { useCallback, type Ref, type RefCallback, type SyntheticEvent } from 'react';

function setRef<T>(ref: Ref<T> | undefined, node: T | null): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }
  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return undefined;
}

/**
 * One callback ref that sets every given ref. Use it to keep your own ref on a
 * part whose `ref` slot is already filled, such as the `ref` that
 * `usePopover().getPopoverProps()` returns. In a component, prefer
 * {@link useComposedRefs}, which keeps the callback stable across renders.
 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => setRef(ref, node));
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  };
}

/** {@link composeRefs} that only changes when one of the refs does. */
export function useComposedRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  // The refs themselves are the dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(composeRefs(...refs), refs);
}

/**
 * Runs the consumer's handler first, then the part's own behavior unless that
 * handler called `event.preventDefault()`. A child that prevented the event on
 * its way up does not switch the part's behavior off.
 */
export function composeHandlers<E extends SyntheticEvent>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
): (event: E) => void {
  return (event) => {
    const preventedBefore = event.defaultPrevented;
    theirs?.(event);
    if (preventedBefore || !event.defaultPrevented) ours(event);
  };
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
