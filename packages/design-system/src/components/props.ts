import { useCallback, useRef, type Ref, type RefCallback, type SyntheticEvent } from 'react';

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
 * For prop getters, which compose a caller's ref inside a callback where
 * {@link useComposedRefs} cannot run. Returns `own` when there is no caller
 * ref, and the same composed callback for as long as the caller's ref is the
 * same, so React does not detach and reattach it on every render.
 */
export function useStableComposedRef<T>(own: RefCallback<T>): (theirs: Ref<T> | undefined) => RefCallback<T> {
  // One composed callback per caller ref, so a getter used on several
  // elements keeps each one stable. Rebuilt when `own` changes.
  const cache = useRef<{ own: RefCallback<T>; map: WeakMap<object, RefCallback<T>> } | null>(null);
  return useCallback(
    (theirs: Ref<T> | undefined) => {
      if (!theirs) return own;
      if (cache.current?.own !== own) cache.current = { own, map: new WeakMap() };
      const { map } = cache.current;
      let composed = map.get(theirs);
      if (!composed) {
        composed = composeRefs(own, theirs);
        map.set(theirs, composed);
      }
      return composed;
    },
    [own],
  );
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

export { cx } from './cx';
