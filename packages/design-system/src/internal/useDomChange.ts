import { useLayoutEffect, useRef, type RefObject } from 'react';

type Watch = { el: Element; observer: MutationObserver | null; stopAncestors: (() => void) | null };

type AncestorWatch = { el: Element; onChange: () => void };
type AncestorRegistry = { observer: MutationObserver; watches: Set<AncestorWatch> };
const ancestorRegistries = new WeakMap<Node, AncestorRegistry>();

// An inline style on an ancestor is most often motion (a transform or an
// opacity written each frame), which cuts no text, so it is left out.
function onAncestorRecords(registry: AncestorRegistry, records: MutationRecord[]) {
  const changed = new Set<Node>();
  for (const record of records) if (record.attributeName !== 'style') changed.add(record.target);
  if (!changed.size) return;
  const hit: AncestorWatch[] = [];
  for (const watch of registry.watches) {
    for (let node: Element | null = watch.el; node; node = node.parentElement) {
      if (changed.has(node)) {
        hit.push(watch);
        break;
      }
    }
  }
  for (const watch of hit) watch.onChange();
}

/**
 * Calls `onChange` when an attribute changes on `el` or an element around it
 * in its tree, such as a selected row's class that product CSS bolds its text
 * with. One observer per tree, shared by every watch, sees the change, and
 * only the watches inside the changed element are called.
 */
function watchAncestors(el: Element, onChange: () => void): (() => void) | null {
  if (typeof MutationObserver === 'undefined') return null;
  const root = el.getRootNode();
  let registry = ancestorRegistries.get(root);
  if (!registry) {
    const created: AncestorRegistry = {
      observer: new MutationObserver((records) => onAncestorRecords(created, records)),
      watches: new Set(),
    };
    created.observer.observe(root, { attributes: true, subtree: true });
    ancestorRegistries.set(root, created);
    registry = created;
  }
  const watch: AncestorWatch = { el, onChange };
  registry.watches.add(watch);
  const owner = registry;
  return () => {
    owner.watches.delete(watch);
    if (owner.watches.size) return;
    owner.observer.disconnect();
    ancestorRegistries.delete(root);
  };
}

export type DomChangeOptions = MutationObserverInit & {
  /** Also call `onChange` when any attribute other than `style` changes on the element or around it. */
  ancestors?: boolean;
};

/**
 * Calls `onChange` when the element in `ref` mounts or is replaced, and when
 * it or its subtree changes as `options` describes. A change made by a commit
 * is handled in that commit's layout phase, before paint; a commit that leaves
 * the element as it was costs one `takeRecords()` and calls nothing. A change
 * made outside a render, such as a child's own state, comes through the
 * observer. Without `MutationObserver`, every commit calls `onChange`.
 */
export function useDomChange(ref: RefObject<Element | null>, onChange: () => void, options: DomChangeOptions): void {
  const latest = useRef(onChange);
  const watch = useRef<Watch | null>(null);

  useLayoutEffect(() => {
    latest.current = onChange;
    const el = ref.current;
    const current = watch.current;
    if (current?.el === el) {
      if (current.observer && current.observer.takeRecords().length === 0) return;
    } else {
      stop(current);
      watch.current = null;
      if (!el) return;
      const { ancestors, ...init } = options;
      const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => latest.current());
      observer?.observe(el, init);
      watch.current = { el, observer, stopAncestors: ancestors ? watchAncestors(el, () => latest.current()) : null };
    }
    onChange();
  });

  useLayoutEffect(
    () => () => {
      stop(watch.current);
      watch.current = null;
    },
    [],
  );
}

function stop(watch: Watch | null) {
  watch?.observer?.disconnect();
  watch?.stopAncestors?.();
}
