// One ResizeObserver and one MutationObserver (sharedMutations.ts) for every
// part on the page that watches a scroller, instead of one or two per part. A page of
// 1,000 tab lists built 6,000 observers before: the list's own pair, its
// scroll arrows' pair and its roving focus's pair. Each target is observed
// once however many parts watch it, and every report of one browser callback
// reaches its listeners in that one callback, so the parts can batch what
// they measure (see layoutBatch.ts).
//
// A test may swap the global observer for a stand-in, so the registry keeps
// the constructor it was built with, and a watch that starts after a swap
// builds a new registry with the new one.

import { observeMutations } from './sharedMutations.js';

type SizeListener = (entry: ResizeObserverEntry) => void;

// Calls each listener still subscribed when its turn comes, so one stopped
// by an earlier listener in the same report hears nothing more. A listener
// that throws doesn't keep the others from hearing; its error is thrown
// after, as it would be from an observer of its own.
function notify<T>(subscribed: readonly T[], call: (subscription: T) => void) {
  for (const subscription of [...subscribed]) {
    if (!subscribed.includes(subscription)) continue;
    try {
      call(subscription);
    } catch (error) {
      setTimeout(() => {
        throw error;
      });
    }
  }
}

// Takes `item` out of `list`, and says whether it was there.
function remove<T>(list: T[], item: T): boolean {
  const at = list.indexOf(item);
  if (at >= 0) list.splice(at, 1);
  return at >= 0;
}

type SizeRegistry = {
  make: typeof ResizeObserver;
  observer: ResizeObserver;
  // A list rather than a set for each target, since a page of 1,000 Buttons
  // keeps 1,000, and a target has one or two listeners.
  listeners: Map<Element, { run: SizeListener }[]>;
};
let sizes: SizeRegistry | null = null;

function sizeRegistry(): SizeRegistry | null {
  if (typeof ResizeObserver === 'undefined') return null;
  if (sizes?.make === ResizeObserver) return sizes;
  const listeners = new Map<Element, { run: SizeListener }[]>();
  const created: SizeRegistry = {
    make: ResizeObserver,
    listeners,
    observer: new ResizeObserver((entries) => {
      for (const entry of entries) {
        const own = listeners.get(entry.target);
        if (own) notify(own, (subscription) => subscription.run(entry));
      }
    }),
  };
  sizes = created;
  return created;
}

/**
 * Calls `listener` with each resize the browser reports for `target`,
 * starting with its size now, as an observer of its own would. A target is
 * observed once however many listen; a listener that joins one already
 * observed has it observed afresh, so the browser reports its size again to
 * every listener, which take a report of an unchanged size as nothing new.
 * Returns the stop.
 */
export function observeSize(target: Element, listener: SizeListener): () => void {
  const registry = sizeRegistry();
  if (!registry) return () => {};
  // Each call subscribes on its own, the same function twice included.
  const subscription = { run: listener };
  let watched = registry.listeners.get(target);
  // A list made with its one listener holds one, where pushing onto an
  // empty list makes room for 17.
  if (!watched) registry.listeners.set(target, (watched = [subscription]));
  else {
    registry.observer.unobserve?.(target);
    watched.push(subscription);
  }
  registry.observer.observe(target);
  return () => {
    if (!remove(watched, subscription) || watched.length) return;
    registry.listeners.delete(target);
    // A test's stand-in may have no unobserve; a target nobody hears then
    // stays observed, and its reports reach no one.
    if (registry.listeners.size) {
      registry.observer.unobserve?.(target);
      return;
    }
    registry.observer.disconnect();
    if (sizes === registry) sizes = null;
  };
}

/** Calls `listener` after children are added to or removed from `target`. Returns the stop. */
export function observeChildren(target: Node, listener: () => void): () => void {
  return observeMutations(target, { childList: true }, () => listener()).stop;
}

/** A scroller's content box from its resize report, fraction kept. */
export type ScrollerBox = { inline: number; block: number };

type ScrollerListener = {
  /** The scroller or one of its children resized; `box` is the scroller's latest content box. */
  resized?: (box: ScrollerBox | null) => void;
  /** Children were added to or removed from the scroller. */
  children?: () => void;
};
type Scroller = {
  listeners: { run: ScrollerListener }[];
  box: ScrollerBox | null;
  stops: Map<Element, () => void>;
  stopChildren: () => void;
};
const scrollers = new WeakMap<Element, Scroller>();

/**
 * Follows a scroller as its scroll arrows and a tab list need it: its own
 * size and each child's, which together decide what overflows, and children
 * coming and going. Every part watching one scroller shares the watch.
 * Returns the stop, and the scroller's latest content box for a part that
 * starts watching after the first report.
 */
export function watchScroller(el: Element, listener: ScrollerListener): { stop: () => void; box: () => ScrollerBox | null } {
  let scroller = scrollers.get(el);
  if (!scroller) {
    const created: Scroller = { listeners: [], box: null, stops: new Map(), stopChildren: () => {} };
    const resized = () => {
      notify(created.listeners, (own) => own.run.resized?.(created.box));
    };
    created.stops.set(
      el,
      observeSize(el, (entry) => {
        const size = entry.contentBoxSize?.[0];
        created.box = size
          ? { inline: size.inlineSize, block: size.blockSize }
          : { inline: entry.contentRect.width, block: entry.contentRect.height };
        resized();
      }),
    );
    const follow = () => {
      const now = new Set(el.children);
      for (const [child, stop] of created.stops) {
        if (child === el || now.has(child)) continue;
        stop();
        created.stops.delete(child);
      }
      for (const child of now) if (!created.stops.has(child)) created.stops.set(child, observeSize(child, resized));
    };
    follow();
    created.stopChildren = observeChildren(el, () => {
      follow();
      notify(created.listeners, (own) => own.run.children?.());
    });
    scrollers.set(el, created);
    scroller = created;
  }
  const watched = scroller;
  const subscription = { run: listener };
  watched.listeners.push(subscription);
  return {
    box: () => watched.box,
    stop: () => {
      if (!remove(watched.listeners, subscription) || watched.listeners.length) return;
      for (const stop of watched.stops.values()) stop();
      watched.stopChildren();
      if (scrollers.get(el) === watched) scrollers.delete(el);
    },
  };
}
