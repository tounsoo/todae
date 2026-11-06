// One ResizeObserver and one child-list MutationObserver for every part on
// the page that watches a scroller, instead of one or two per part. A page of
// 1,000 tab lists built 6,000 observers before: the list's own pair, its
// scroll arrows' pair and its roving focus's pair. Each target is observed
// once however many parts watch it, and every report of one browser callback
// reaches its listeners in that one callback, so the parts can batch what
// they measure (see layoutBatch.ts).
//
// A test may swap the global observer for a stand-in, so each registry keeps
// the constructor it was built with, and a watch that starts after a swap
// builds a new registry with the new one.

type SizeListener = (entry: ResizeObserverEntry) => void;

// Calls each listener still subscribed when its turn comes, so one stopped
// by an earlier listener in the same report hears nothing more. A listener
// that throws doesn't keep the others from hearing; its error is thrown
// after, as it would be from an observer of its own.
function notify<T>(subscribed: Set<T>, call: (subscription: T) => void) {
  for (const subscription of [...subscribed]) {
    if (!subscribed.has(subscription)) continue;
    try {
      call(subscription);
    } catch (error) {
      setTimeout(() => {
        throw error;
      });
    }
  }
}
type SizeRegistry = {
  make: typeof ResizeObserver;
  observer: ResizeObserver;
  listeners: Map<Element, Set<{ run: SizeListener }>>;
};
let sizes: SizeRegistry | null = null;

function sizeRegistry(): SizeRegistry | null {
  if (typeof ResizeObserver === 'undefined') return null;
  if (sizes?.make === ResizeObserver) return sizes;
  const listeners = new Map<Element, Set<{ run: SizeListener }>>();
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
  let own = registry.listeners.get(target);
  if (!own) {
    own = new Set();
    registry.listeners.set(target, own);
  } else registry.observer.unobserve(target);
  registry.observer.observe(target);
  // Each call subscribes on its own, the same function twice included.
  const subscription = { run: listener };
  own.add(subscription);
  return () => {
    if (!own.delete(subscription) || own.size) return;
    registry.listeners.delete(target);
    if (registry.listeners.size) {
      registry.observer.unobserve(target);
      return;
    }
    registry.observer.disconnect();
    if (sizes === registry) sizes = null;
  };
}

type ChildRegistry = {
  make: typeof MutationObserver;
  observer: MutationObserver;
  listeners: Map<Node, Set<{ run: () => void }>>;
  // Targets the observer still watches that nobody listens to any more, since
  // a MutationObserver can't stop watching one node alone.
  dropped: number;
};
let childLists: ChildRegistry | null = null;

function deliver(registry: ChildRegistry, records: MutationRecord[]) {
  const changed = new Set<Node>();
  for (const record of records) changed.add(record.target);
  for (const target of changed) {
    const own = registry.listeners.get(target);
    if (own) notify(own, (subscription) => subscription.run());
  }
}

function childRegistry(): ChildRegistry | null {
  if (typeof MutationObserver === 'undefined') return null;
  if (childLists?.make === MutationObserver) return childLists;
  const created: ChildRegistry = {
    make: MutationObserver,
    listeners: new Map(),
    dropped: 0,
    observer: new MutationObserver((records) => deliver(created, records)),
  };
  childLists = created;
  return created;
}

/** Calls `listener` after children are added to or removed from `target`. Returns the stop. */
export function observeChildren(target: Node, listener: () => void): () => void {
  const registry = childRegistry();
  if (!registry) return () => {};
  let own = registry.listeners.get(target);
  if (!own) {
    own = new Set();
    registry.listeners.set(target, own);
    registry.observer.observe(target, { childList: true });
  }
  const subscription = { run: listener };
  own.add(subscription);
  return () => {
    if (!own.delete(subscription) || own.size) return;
    registry.listeners.delete(target);
    if (!registry.listeners.size) {
      registry.observer.disconnect();
      if (childLists === registry) childLists = null;
      return;
    }
    // Once the targets nobody hears outnumber the rest, start over with the
    // live ones, handing on what is pending first. Each restart follows as
    // many stops as it re-observes, so a page unmounting 1,000 lists costs
    // about 2,000 observes in all.
    registry.dropped++;
    if (registry.dropped <= registry.listeners.size) return;
    deliver(registry, registry.observer.takeRecords());
    registry.observer.disconnect();
    registry.dropped = 0;
    for (const node of registry.listeners.keys()) registry.observer.observe(node, { childList: true });
  };
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
  listeners: Set<{ run: ScrollerListener }>;
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
    const created: Scroller = { listeners: new Set(), box: null, stops: new Map(), stopChildren: () => {} };
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
  watched.listeners.add(subscription);
  return {
    box: () => watched.box,
    stop: () => {
      if (!watched.listeners.delete(subscription) || watched.listeners.size) return;
      for (const stop of watched.stops.values()) stop();
      watched.stopChildren();
      if (scrollers.get(el) === watched) scrollers.delete(el);
    },
  };
}
