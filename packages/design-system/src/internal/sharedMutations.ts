// One MutationObserver for every part on the page that watches the DOM,
// instead of one per part. A page of 1,000 tab lists built 1,001 before: one
// for each list's roving focus and one for every list's children. Each
// target is observed once, with the widest options its listeners ask for, and
// each listener hears only the records its own options would have produced.
//
// An observer of one's own also hears, until its next report, what happens
// inside a subtree removed from its target (the browser's transient
// observers). A record about such a subtree is routed the same way: to every
// listener that watched the subtree the removed node left, so a listener
// sees the same records it would have on its own. A listener can hear a
// record about a node that has since moved into another listener's tree; the
// parts using this take a record outside their tree as nothing new.
// Routing knows only the removals of the records it routes together, so a
// change inside a removed subtree after a flush took the removal, which an
// observer of its own would still hear until its next report, reaches no one;
// the removal itself already told each listener the subtree left.
//
// A test may swap the global observer for a stand-in, so the registry keeps
// the constructor it was built with, and a watch that starts after a swap
// builds a new registry with the new one.

/** What to watch: a MutationObserverInit without the old values, which a shared observer can't keep apart. */
export type MutationWatch = {
  childList?: boolean;
  attributes?: boolean;
  attributeFilter?: readonly string[];
  characterData?: boolean;
  subtree?: boolean;
};

type Listener = (records: MutationRecord[]) => void;
type Subscription = {
  target: Node;
  watch: MutationWatch;
  run: Listener;
  live: boolean;
};

type Registry = {
  make: typeof MutationObserver;
  observer: MutationObserver;
  listeners: Map<Node, Set<Subscription>>;
  // The options each target is observed with now, to skip a re-observe that changes nothing.
  observed: Map<Node, string>;
  // Targets the observer still watches that nobody listens to any more, since
  // a MutationObserver can't stop watching one node alone.
  dropped: number;
  // Records taken for listeners not yet called, in the order they came.
  pending: Map<Subscription, MutationRecord[]>;
  scheduled: boolean;
};
let shared: Registry | null = null;

const NONE: ReadonlySet<Subscription> = new Set();

function hears(subscription: Subscription, record: MutationRecord): boolean {
  const { watch } = subscription;
  if (!watch.subtree && record.target !== subscription.target) return false;
  if (record.type === 'childList') return watch.childList === true;
  if (record.type === 'characterData') return watch.characterData === true;
  if (!watch.attributes && !watch.attributeFilter) return false;
  return !watch.attributeFilter || watch.attributeFilter.includes(record.attributeName ?? '');
}

/** Hands each record to the listeners whose tree it happened in, onto `pending`. */
function route(registry: Registry, records: MutationRecord[]) {
  if (!records.length) return;
  // The subtree listeners each removed node was taken from, in this batch.
  const removedFrom = new Map<Node, Set<Subscription>>();
  let routes: ReadonlySet<Subscription>[] = [];
  // A removal can make an earlier record, about a node inside what was
  // removed, belong to the tree it left, so route again until nothing new is
  // learnt. Each pass only adds, and most batches need one or two.
  for (let changed = true; changed; ) {
    changed = false;
    // The listeners of every tree a node sits in, shared by every record
    // under it, so a batch walks each ancestor once.
    const around = new Map<Node, ReadonlySet<Subscription>>();
    const listenersAt = (start: Node): ReadonlySet<Subscription> => {
      const path: Node[] = [];
      let found: ReadonlySet<Subscription> = NONE;
      for (let node: Node | null = start; node; node = node.parentNode) {
        const known = around.get(node);
        if (known) {
          found = known;
          break;
        }
        path.push(node);
      }
      for (let i = path.length - 1; i >= 0; i--) {
        const node = path[i]!;
        const own = registry.listeners.get(node);
        const left = removedFrom.get(node);
        if (own || left) {
          const next = new Set(found);
          for (const subscription of own ?? NONE) next.add(subscription);
          for (const subscription of left ?? NONE) next.add(subscription);
          found = next;
        }
        around.set(node, found);
      }
      return found;
    };
    routes = records.map((record) => listenersAt(record.target));
    records.forEach((record, index) => {
      if (record.type !== 'childList' || !record.removedNodes.length) return;
      for (const subscription of routes[index]!) {
        if (!subscription.watch.subtree) continue;
        for (const node of record.removedNodes) {
          let left = removedFrom.get(node);
          if (!left) removedFrom.set(node, (left = new Set()));
          if (left.has(subscription)) continue;
          left.add(subscription);
          changed = true;
        }
      }
    });
  }
  records.forEach((record, index) => {
    for (const subscription of routes[index]!) {
      if (!hears(subscription, record)) continue;
      const own = registry.pending.get(subscription);
      if (own) own.push(record);
      else registry.pending.set(subscription, [record]);
    }
  });
}

// Calls each listener still subscribed when its turn comes. A listener that
// throws doesn't keep the others from hearing; its error is thrown after, as
// it would be from an observer of its own.
function call(subscription: Subscription, records: MutationRecord[]) {
  if (!subscription.live) return;
  try {
    subscription.run(records);
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

function deliver(registry: Registry) {
  registry.scheduled = false;
  const due = [...registry.pending];
  registry.pending.clear();
  for (const [subscription, records] of due) call(subscription, records);
}

// Records taken early for others reach them a microtask later, as their own
// observer's report would have.
function deliverSoon(registry: Registry) {
  if (registry.scheduled || !registry.pending.size) return;
  registry.scheduled = true;
  queueMicrotask(() => {
    if (registry.scheduled) deliver(registry);
  });
}

function registry(): Registry | null {
  if (typeof MutationObserver === 'undefined') return null;
  if (shared?.make === MutationObserver) return shared;
  const created: Registry = {
    make: MutationObserver,
    listeners: new Map(),
    observed: new Map(),
    dropped: 0,
    pending: new Map(),
    scheduled: false,
    observer: new MutationObserver((records) => {
      route(created, records);
      deliver(created);
    }),
  };
  shared = created;
  return created;
}

// The widest options of a target's listeners: one asking for every attribute
// outweighs another's filter.
function widest(subscriptions: Iterable<Subscription>): MutationObserverInit {
  let childList = false;
  let characterData = false;
  let subtree = false;
  let attributes = false;
  let filter: Set<string> | null = new Set();
  for (const { watch } of subscriptions) {
    childList ||= watch.childList === true;
    characterData ||= watch.characterData === true;
    subtree ||= watch.subtree === true;
    if (!watch.attributes && !watch.attributeFilter) continue;
    attributes = true;
    if (!watch.attributeFilter) filter = null;
    else for (const name of watch.attributeFilter) filter?.add(name);
  }
  // A subtree is watched for removals even when nobody asks for children,
  // since a record about a node removed in the same batch is routed by them.
  const init: MutationObserverInit = { childList: childList || subtree, characterData, subtree, attributes };
  if (attributes && filter) init.attributeFilter = [...filter].sort();
  return init;
}

function observe(registry: Registry, target: Node, subscriptions: Set<Subscription>) {
  const init = widest(subscriptions);
  const key = JSON.stringify(init);
  if (registry.observed.get(target) === key) return;
  registry.observed.set(target, key);
  registry.observer.observe(target, init);
}

export type MutationWatcher = {
  /** Stops listening. */
  stop: () => void;
  /** Calls the listener now with any records waiting for it, as `takeRecords()` would hand them. */
  flush: () => void;
};

/**
 * Calls `listener` with the mutation records `watch` asks for at `target`,
 * as an observer of its own would, a microtask after they happen. Every
 * target shares one observer.
 */
export function observeMutations(target: Node, watch: MutationWatch, listener: Listener): MutationWatcher {
  const reg = registry();
  if (!reg) return { stop: () => {}, flush: () => {} };
  // Records already waiting happened before this listener, which an observer
  // of its own wouldn't hear, so they go to the others first.
  route(reg, reg.observer.takeRecords());
  deliverSoon(reg);
  const subscription: Subscription = { target, watch, run: listener, live: true };
  let own = reg.listeners.get(target);
  if (!own) reg.listeners.set(target, (own = new Set()));
  own.add(subscription);
  observe(reg, target, own);
  const watched = own;
  return {
    flush: () => {
      if (!subscription.live) return;
      route(reg, reg.observer.takeRecords());
      const records = reg.pending.get(subscription);
      reg.pending.delete(subscription);
      deliverSoon(reg);
      if (records) call(subscription, records);
    },
    stop: () => {
      if (!subscription.live) return;
      subscription.live = false;
      reg.pending.delete(subscription);
      watched.delete(subscription);
      // Narrower options for the listeners left on this target.
      if (watched.size) return observe(reg, target, watched);
      reg.listeners.delete(target);
      if (!reg.listeners.size) {
        reg.observer.disconnect();
        reg.pending.clear();
        reg.scheduled = false;
        if (shared === reg) shared = null;
        return;
      }
      // Once the targets nobody hears outnumber the rest, start over with the
      // live ones, handing on what is pending first. Each restart follows as
      // many stops as it re-observes, so a page unmounting 1,000 lists costs
      // about 2,000 observes in all.
      reg.dropped++;
      if (reg.dropped <= reg.listeners.size) return;
      route(reg, reg.observer.takeRecords());
      deliverSoon(reg);
      reg.observer.disconnect();
      reg.observed.clear();
      reg.dropped = 0;
      for (const [node, subscriptions] of reg.listeners) observe(reg, node, subscriptions);
    },
  };
}
