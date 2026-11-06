import { useLayoutEffect, useRef, type RefObject } from 'react';

type Watch = { el: Element; observer: MutationObserver | null; stopAncestors: (() => void) | null };

type AncestorWatch = { el: Element; ownCovers: (name: string) => boolean; onChange: () => void };
type AncestorRegistry = { observer: MutationObserver; watches: Set<AncestorWatch> };
const ancestorRegistries = new WeakMap<Node, AncestorRegistry>();

// Attributes that cut no text but change often: a list moves
// `aria-activedescendant` and a roving `tabindex` on every arrow key, a modal
// layer sets `inert` and `aria-hidden` on the rest of the page, and a cut
// text's own `tabindex`, `aria-describedby` and `data-todae-cut` come from its
// measure, so watching them would measure it again for its own answer.
const QUIET = new Set(['aria-activedescendant', 'aria-describedby', 'aria-hidden', 'data-todae-cut', 'inert', 'tabindex']);

// The element around `node`, through a shadow root to its host.
function around(node: Element): Element | null {
  const parent = node.parentNode;
  if (parent instanceof Element) return parent;
  return parent && 'host' in parent ? (parent as ShadowRoot).host : null;
}

function onAncestorRecords(registry: AncestorRegistry, records: MutationRecord[]) {
  const changed = new Map<Node, string[]>();
  for (const record of records) {
    const name = record.attributeName ?? '';
    if (QUIET.has(name)) continue;
    const names = changed.get(record.target);
    if (names) names.push(name);
    else changed.set(record.target, [name]);
  }
  if (!changed.size) return;
  const hit: AncestorWatch[] = [];
  for (const watch of registry.watches) {
    for (let node: Element | null = watch.el; node; node = around(node)) {
      const names = changed.get(node);
      // The element's own observer already reports the attributes it watches.
      if (names && (node !== watch.el || names.some((name) => !watch.ownCovers(name)))) {
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
 * Calls `onChange` when an attribute changes on `el` or an element around it,
 * through shadow hosts, such as a selected row's class that product CSS bolds
 * its text with. One observer per tree, shared by every watch, sees the
 * change, and only the watches inside the changed element are called.
 */
function watchAncestors(el: Element, ownCovers: (name: string) => boolean, onChange: () => void): (() => void) | null {
  if (typeof MutationObserver === 'undefined') return null;
  const watch: AncestorWatch = { el, ownCovers, onChange };
  const owners = treesOf(el).map((root) => {
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
    registry.watches.add(watch);
    return [root, registry] as const;
  });
  return () => {
    for (const [root, registry] of owners) {
      registry.watches.delete(watch);
      if (registry.watches.size) continue;
      registry.observer.disconnect();
      ancestorRegistries.delete(root);
    }
  };
}

export type DomChangeOptions = MutationObserverInit & {
  /**
   * Also call `onChange` when an attribute changes on the element or an element
   * around it, out through shadow hosts, except the few that change often and cut no text.
   */
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
      const ownCovers = (name: string) => !!init.attributes && (!init.attributeFilter || init.attributeFilter.includes(name));
      watch.current = { el, observer, stopAncestors: ancestors ? watchAncestors(el, ownCovers, () => latest.current()) : null };
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
