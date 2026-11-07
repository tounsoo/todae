import { useLayoutEffect, useState } from 'react';

/**
 * Stack offsets from each toast's own height, as CSS variables on the list
 * and its items, so the stack layout needs no measuring of its own:
 * `--toast-index`, `--toast-offset`, `--toast-front-height` and
 * `--toast-count`. Read from the toast inside each item, which the collapsed
 * layout clips to the front toast's height but never squeezes; an observer
 * reads it again as the stack narrows and widens it, which resizes the toast. `listKey` changes with
 * the items, which the observer doesn't see. Returns the list's ref.
 */
export function useStackMeasure(listKey: string): (list: HTMLOListElement | null) => void {
  const [list, setList] = useState<HTMLOListElement | null>(null);
  useLayoutEffect(() => {
    if (!list) return;
    const measure = () => {
      const items = [...list.children] as HTMLElement[];
      let offset = 0;
      items.forEach((item, index) => {
        const height = (item.firstElementChild as HTMLElement | null)?.offsetHeight ?? item.offsetHeight;
        item.style.setProperty('--toast-index', String(index));
        item.style.setProperty('--toast-offset', `${offset}px`);
        if (index === 0) list.style.setProperty('--toast-front-height', `${height}px`);
        offset += height;
      });
      list.style.setProperty('--toast-count', String(items.length));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    // The toast inside each item, which is what it measures: the item's own
    // height changes every frame as a listed toast leaves, and reading it again
    // then would change nothing.
    for (const item of list.children) observer.observe(item.firstElementChild ?? item);
    return () => observer.disconnect();
  }, [list, listKey]);
  return setList;
}
