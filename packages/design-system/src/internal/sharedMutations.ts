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
// sees the same records it would have on its own.
//
// Where it can't match an observer of its own, it hears more or less only
// about nodes outside a listener's tree, which the parts using this don't
// look at, since they read the DOM again on any record:
// - Records are routed by where a node is when they're read, so a listener can
//   hear a record about a node from before it moved into or out of its tree.
// - Observing a target again, when a listener with other options starts or
//   stops on it, or starting over after many stops, drops the browser's
//   transient observers, so later changes inside a subtree removed before
//   then go unheard. An observer of its own would hear them until its next
//   report. Holding those nodes would keep removed subtrees alive.
// - A subtree listener that doesn't ask for children stops hearing a removed
//   subtree at the observer's next report, where an observer of its own would
//   until its own next record.
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
  // When it started, since observers of their own are called in the order they were made.
  order: number;
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
  // The subtree listeners of the trees each node was removed from since the
  // last report, for records a take left behind it, as the browser keeps its
  // transient observers until the next report.
  removed: Map<Node, ReadonlySet<Subscription>>;
  forgetting: boolean;
};
let shared: Registry | null = null;
let started = 0;

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
  // The records that removed each node, in this batch.
  const removals = new Map<Node, MutationRecord[]>();
  for (const record of records) {
    if (record.type !== 'childList') continue;
    for (const node of record.removedNodes) {
      const own = removals.get(node);
      if (own) own.push(record);
      else removals.set(node, [record]);
    }
  }
  // The listeners of every tree a node sits in or was removed from, worked
  // out once per node, so a batch costs about one walk of each ancestor
  // however its removals nest or come in order.
  const around = new Map<Node, ReadonlySet<Subscription>>();
  const resolving = new Set<Node>();
  const left = new Map<Node, ReadonlySet<Subscription>>();
  // Of a tree's listeners, those watching its subtree, shared by every node
  // removed from the same place, so clearing a long list costs no set per row.
  const subtrees = new Map<ReadonlySet<Subscription>, ReadonlySet<Subscription>>();
  const subtreeOf = (listeners: ReadonlySet<Subscription>): ReadonlySet<Subscription> => {
    let found = subtrees.get(listeners);
    if (!found) subtrees.set(listeners, (found = new Set([...listeners].filter(({ watch }) => watch.subtree))));
    return found;
  };
  // The subtree listeners of the trees `node` was removed from.
  const leftFrom = (node: Node): ReadonlySet<Subscription> => {
    const known = left.get(node);
    if (known) return known;
    const earlier = registry.removed.get(node);
    const by = removals.get(node);
    // A node moved under what it left leads back to itself; stop there.
    if (!by || resolving.has(node)) return earlier ?? NONE;
    resolving.add(node);
    let found: ReadonlySet<Subscription>;
    if (!earlier && by.length === 1) found = subtreeOf(listenersAt(by[0]!.target));
    else {
      const all = new Set(earlier ?? NONE);
      for (const record of by) for (const subscription of subtreeOf(listenersAt(record.target))) all.add(subscription);
      found = all;
    }
    resolving.delete(node);
    left.set(node, found);
    return found;
  };
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
      const gone = removals.has(node) || registry.removed.has(node) ? leftFrom(node) : NONE;
      if (own || gone.size) {
        const next = new Set(found);
        for (const subscription of own ?? NONE) next.add(subscription);
        for (const subscription of gone) next.add(subscription);
        found = next;
      }
      around.set(node, found);
    }
    return found;
  };
  for (const record of records) {
    for (const subscription of listenersAt(record.target)) {
      if (!hears(subscription, record)) continue;
      const own = registry.pending.get(subscription);
      if (own) own.push(record);
      else registry.pending.set(subscription, [record]);
    }
  }
  for (const node of removals.keys()) {
    const from = leftFrom(node);
    if (from.size) registry.removed.set(node, from);
  }
  // A page that goes quiet after a take lets go of what it removed.
  if (!registry.removed.size || registry.forgetting) return;
  registry.forgetting = true;
  setTimeout(() => {
    registry.forgetting = false;
    registry.removed.clear();
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

// Calls listeners in the order they started. Each one's records are taken
// from `pending` as its turn comes, so one that an earlier listener's take
// already handed its records to isn't called with them again, nor with the
// older ones after the newer.
function deliver(registry: Registry) {
  registry.scheduled = false;
  while (registry.pending.size) {
    const due = [...registry.pending.keys()].sort((a, b) => a.order - b.order);
    for (const subscription of due) {
      const records = registry.pending.get(subscription);
      if (!records) continue;
      registry.pending.delete(subscription);
      call(subscription, records);
    }
  }
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
    removed: new Map(),
    forgetting: false,
    observer: new MutationObserver((records) => {
      route(created, records);
      // The browser has dropped its transient observers for this report.
      created.removed.clear();
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
  /** Hands back the records waiting for this listener, which it then won't hear, as `takeRecords()` would. */
  take: () => MutationRecord[];
};

/**
 * Calls `listener` with the mutation records `watch` asks for at `target`,
 * as an observer of its own would, a microtask after they happen. Every
 * target shares one observer, so a take hands the other listeners what it
 * took for them a microtask later.
 */
export function observeMutations(target: Node, watch: MutationWatch, listener: Listener): MutationWatcher {
  const reg = registry();
  if (!reg) return { stop: () => {}, take: () => [] };
  // Records already waiting happened before this listener, which an observer
  // of its own wouldn't hear, so they go to the others first.
  route(reg, reg.observer.takeRecords());
  deliverSoon(reg);
  const subscription: Subscription = { target, watch, run: listener, live: true, order: ++started };
  let own = reg.listeners.get(target);
  if (!own) reg.listeners.set(target, (own = new Set()));
  own.add(subscription);
  observe(reg, target, own);
  const watched = own;
  return {
    take: () => {
      if (!subscription.live) return [];
      route(reg, reg.observer.takeRecords());
      const records = reg.pending.get(subscription) ?? [];
      reg.pending.delete(subscription);
      deliverSoon(reg);
      return records;
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
      reg.removed.clear();
      reg.dropped = 0;
      for (const [node, subscriptions] of reg.listeners) observe(reg, node, subscriptions);
    },
  };
}
