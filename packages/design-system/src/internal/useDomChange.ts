import { useLayoutEffect, useRef, type RefObject } from 'react';

type Watch = { el: Element; observer: MutationObserver | null; stopAncestors: (() => void) | null };

type AncestorWatch = { el: Element; run: () => void };
type AncestorRegistry = { observer: MutationObserver; watches: Set<AncestorWatch> };
const ancestorRegistries = new WeakMap<Node, AncestorRegistry>();

// Attributes that cut no text but change often: a list's
// `aria-activedescendant` and a roving `tabindex` on every arrow key,
// `aria-busy` while results load, a popover's open and motion markers, a tip
// trigger's `aria-describedby`, and the cut marker a measure writes,
// `data-todae-cut`, so CSS keyed on it can't make a text measure again for its
// own answer.
const QUIET = new Set([
  'aria-activedescendant',
  'aria-busy',
  'aria-describedby',
  'data-entered',
  'data-popover-open',
  'data-todae-cut',
  'data-todae-entering',
  'data-todae-exiting',
  'data-todae-settled',
  'tabindex',
]);

const isLoud = (record: MutationRecord) => record.type !== 'attributes' || !QUIET.has(record.attributeName ?? '');

// Asks for one frame, and returns the scheduler it asked, so a frame that
// test timers swapped out can be told from one still to come.
const nextFrame = (run: () => void): unknown => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
    return requestAnimationFrame;
  }
  setTimeout(run, 16);
  return setTimeout;
};
const scheduler = () => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout);

// A change that no commit made waits until its element has gone a frame
// without another, so an animation that writes an attribute or inline style
// each frame costs one measure when it ends, and a burst costs one. Each
// element waits on its own changes, so an animation elsewhere holds up nothing.
// One that runs longer, such as a looping pulse or a ticking clock, is measured
// about every `MAX_WAIT` frames, so a change under it is still seen.
const MAX_WAIT = 12;
let changedNow = new Set<() => void>();
// Each waiting run, and the frames it has waited.
let waiting = new Map<() => void, number>();
// The pending frame: when and from what it was asked for. A frame asked for
// through a scheduler that has since been swapped, as a test's fake timers do,
// or more than 250ms ago, as in a background tab, is asked for again rather
// than waited on.
let pending: { at: number; from: unknown } | null = null;

// A frame asked for again replaces the one before it, which then does nothing
// if it comes after all, so there is only ever one chain of frames.
function request() {
  const ask: { at: number; from: unknown } = { at: Date.now(), from: null };
  pending = ask;
  ask.from = nextFrame(() => {
    if (pending === ask) onFrame();
  });
}

function later(run: () => void) {
  changedNow.add(run);
  if (pending && pending.from === scheduler() && Date.now() - pending.at < 250) return;
  request();
}

function cancel(run: () => void) {
  changedNow.delete(run);
  waiting.delete(run);
}

function onFrame() {
  pending = null;
  const due = new Set<() => void>();
  const next = new Map<() => void, number>();
  for (const [run, frames] of waiting) {
    if (!changedNow.has(run) || frames + 1 >= MAX_WAIT) due.add(run);
    else next.set(run, frames + 1);
  }
  for (const run of changedNow) if (!next.has(run) && !due.has(run)) next.set(run, 0);
  waiting = next;
  changedNow = new Set();
  if (waiting.size) request();
  for (const run of due) {
    // One measure that throws doesn't keep the rest from running.
    try {
      run();
    } catch (error) {
      setTimeout(() => {
        throw error;
      });
    }
  }
}

// The element around `node`, through a shadow root to its host. `nodeType`
// rather than `instanceof`, so a text portaled into an iframe walks its tree.
function around(node: Element): Element | null {
  const parent = node.parentNode;
  if (!parent) return null;
  if (parent.nodeType === 1) return parent as Element;
  return 'host' in parent ? (parent as ShadowRoot).host : null;
}

function onAncestorRecords(registry: AncestorRegistry, records: MutationRecord[]) {
  const changed = new Set<Node>();
  for (const record of records) if (isLoud(record)) changed.add(record.target);
  if (!changed.size) return;
  // Whether an element is a changed one or sits inside one, shared by every
  // watch, so the watches under one row walk its ancestors once.
  const inside = new Map<Element, boolean>();
  const isInside = (start: Element | null): boolean => {
    const path: Element[] = [];
    let found = false;
    for (let node = start; node; node = around(node)) {
      const known = inside.get(node);
      if (known !== undefined) {
        found = known;
        break;
      }
      path.push(node);
      if (changed.has(node)) {
        found = true;
        break;
      }
    }
    for (const node of path) inside.set(node, found);
    return found;
  };
  // The element's own observer reports the element itself.
  for (const watch of registry.watches) if (isInside(around(watch.el))) later(watch.run);
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
 * Calls `run` a frame after an attribute changes on an element around `el`,
 * through shadow hosts, such as a selected row's class that product CSS bolds
 * its text with. One observer per tree, shared by every watch, sees the
 * change, and only the watches inside the changed element are called.
 */
function watchAncestors(el: Element, run: () => void): (() => void) | null {
  if (typeof MutationObserver === 'undefined') return null;
  const watch: AncestorWatch = { el, run };
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
  /** Also call `onChange` when an attribute changes on an element around it, out through shadow hosts. */
  ancestors?: boolean;
};

/**
 * Calls `onChange` when the element in `ref` mounts or is replaced, and when
 * it, its subtree or, with `ancestors`, an element around it changes as
 * `options` describes, apart from the quiet attributes above. A change a
 * commit made to the element or inside it is handled in that commit's layout
 * phase, before paint; a change around it waits a frame, like one no commit made. A commit
 * that leaves the element as it was costs one `takeRecords()` and calls
 * nothing. A change made outside a render, such as a child's own state or an
 * animation's inline style, is handled once the element has gone a frame
 * without another. Without `MutationObserver`, every commit calls `onChange`.
 */
export function useDomChange(ref: RefObject<Element | null>, onChange: () => void, options: DomChangeOptions): void {
  const latest = useRef(onChange);
  const watch = useRef<Watch | null>(null);
  const runRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    latest.current = onChange;
    const run = (runRef.current ??= () => latest.current());
    const el = ref.current;
    const current = watch.current;
    if (current?.el === el) {
      if (current.observer && !current.observer.takeRecords().some(isLoud)) return;
    } else {
      stop(current, run);
      watch.current = null;
      if (!el) return;
      const { ancestors, ...init } = options;
      const observer =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver((records) => {
              if (records.some(isLoud)) later(run);
            });
      observer?.observe(el, init);
      watch.current = { el, observer, stopAncestors: ancestors ? watchAncestors(el, run) : null };
    }
    // This measure covers any change still waiting.
    cancel(run);
    onChange();
  });

  useLayoutEffect(
    () => () => {
      if (runRef.current) stop(watch.current, runRef.current);
      watch.current = null;
    },
    [],
  );
}

function stop(watch: Watch | null, run: () => void) {
  watch?.observer?.disconnect();
  watch?.stopAncestors?.();
  cancel(run);
}
