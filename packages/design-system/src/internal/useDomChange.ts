import { useLayoutEffect, useRef, type RefObject } from 'react';

type Watch = { el: Element; observer: MutationObserver | null; stopAncestors: (() => void) | null };

type AncestorWatch = { el: Element; onChange: () => void };
type AncestorRegistry = {
  observer: MutationObserver;
  watches: Set<AncestorWatch>;
  // Elements whose attributes changed since the last flush.
  changed: Set<Node>;
  frame: number | null;
  // Whether a record came in since the last frame.
  busy: boolean;
};
const ancestorRegistries = new WeakMap<Node, AncestorRegistry>();

// Attributes that cut no text but change on every arrow key, a list's
// `aria-activedescendant` and a roving `tabindex`, and the ones a cut text's
// measure writes itself, `data-todae-cut` and `aria-describedby`, so CSS keyed
// on the cut marker can't make it measure again for its own answer.
const QUIET = new Set(['aria-activedescendant', 'aria-describedby', 'data-todae-cut', 'tabindex']);

const isLoud = (record: MutationRecord) => record.type !== 'attributes' || !QUIET.has(record.attributeName ?? '');

const nextFrame = (run: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : (setTimeout(run, 16) as unknown as number);
const cancelFrame = (frame: number) =>
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(frame) : clearTimeout(frame);

// The element around `node`, through a shadow root to its host. `nodeType`
// rather than `instanceof`, so a text portaled into an iframe walks its tree.
function around(node: Element): Element | null {
  const parent = node.parentNode;
  if (!parent) return null;
  if (parent.nodeType === 1) return parent as Element;
  return 'host' in parent ? (parent as ShadowRoot).host : null;
}

function onAncestorRecords(registry: AncestorRegistry, records: MutationRecord[]) {
  for (const record of records) if (isLoud(record)) registry.changed.add(record.target);
  if (!registry.changed.size) return;
  registry.busy = true;
  registry.frame ??= nextFrame(() => onFrame(registry));
}

// Measures once the tree has gone a frame without a change, so an animation
// that writes an inline style each frame costs one measure when it ends, and a
// burst of changes costs one.
function onFrame(registry: AncestorRegistry) {
  if (registry.busy) {
    registry.busy = false;
    registry.frame = nextFrame(() => onFrame(registry));
    return;
  }
  registry.frame = null;
  const changed = registry.changed;
  registry.changed = new Set();
  const hit: AncestorWatch[] = [];
  for (const watch of registry.watches) {
    // The element's own observer reports the element itself.
    for (let node = around(watch.el); node; node = around(node)) {
      if (changed.has(node)) {
        hit.push(watch);
        break;
      }
    }
  }
  for (const watch of hit) watch.onChange();
}

// The trees an element sits in: its own, and each shadow host's, out to the document.
function treesOf(el: Element): Node[] {
  const trees: Node[] = [];
  for (let root: Node = el.getRootNode(); ; root = (root as ShadowRoot).host.getRootNode()) {
    trees.push(root);
    if (!('host' in root)) return trees;
  }
}

/**
 * Calls `onChange` a frame after an attribute changes on an element around
 * `el`, through shadow hosts, such as a selected row's class that product CSS
 * bolds its text with. One observer per tree, shared by every watch, sees the
 * change, and only the watches inside the changed element are called.
 */
function watchAncestors(el: Element, onChange: () => void): (() => void) | null {
  if (typeof MutationObserver === 'undefined') return null;
  const watch: AncestorWatch = { el, onChange };
  const owners = treesOf(el).map((root) => {
    let registry = ancestorRegistries.get(root);
    if (!registry) {
      const created: AncestorRegistry = {
        observer: new MutationObserver((records) => onAncestorRecords(created, records)),
        watches: new Set(),
        changed: new Set(),
        frame: null,
        busy: false,
      };
      created.observer.observe(root, { attributes: true, subtree: true });
      ancestorRegistries.set(root, created);
      registry = created;
    }
    registry.watches.add(watch);
    return [root, registry] as const;
  });
  return () => {
    for (const [root, registry] of owners) {
      registry.watches.delete(watch);
      if (registry.watches.size) continue;
      registry.observer.disconnect();
      if (registry.frame != null) cancelFrame(registry.frame);
      ancestorRegistries.delete(root);
    }
  };
}

export type DomChangeOptions = MutationObserverInit & {
  /**
   * Also call `onChange` a frame after an attribute changes on an element
   * around it, out through shadow hosts. Leaves out an attribute that moves on
   * every arrow key, `aria-activedescendant` or a roving `tabindex`, and the
   * cut marker and `aria-describedby` a measure writes.
   */
  ancestors?: boolean;
};

/**
 * Calls `onChange` when the element in `ref` mounts or is replaced, and when
 * it or its subtree changes as `options` describes, apart from the attributes
 * a measure writes. A change made by a commit is handled in that commit's
 * layout phase, before paint; a commit that leaves the element as it was costs
 * one `takeRecords()` and calls nothing. A change made outside a render, such
 * as a child's own state, comes through the observer. Without
 * `MutationObserver`, every commit calls `onChange`.
 */
export function useDomChange(ref: RefObject<Element | null>, onChange: () => void, options: DomChangeOptions): void {
  const latest = useRef(onChange);
  const watch = useRef<Watch | null>(null);

  useLayoutEffect(() => {
    latest.current = onChange;
    const el = ref.current;
    const current = watch.current;
    if (current?.el === el) {
      if (current.observer && !current.observer.takeRecords().some(isLoud)) return;
    } else {
      stop(current);
      watch.current = null;
      if (!el) return;
      const { ancestors, ...init } = options;
      const observer =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver((records) => {
              if (records.some(isLoud)) latest.current();
            });
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
