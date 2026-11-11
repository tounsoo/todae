// Runs in the benchmark page before any other script (Playwright's init
// script). It counts what a component leaves running on the page:
// - listeners on document and window that are still attached,
// - observers that are still observing something, and how many were created,
// - React components rendered per commit, through a stand-in for the React
//   DevTools hook (the same rule DevTools uses for skipped subtrees).
// A `once` listener isn't counted, since it removes itself.
(() => {
  const listeners = new Map([
    [document, new Map()],
    [window, new Map()],
  ]);
  const capture = (options) => (typeof options === 'boolean' ? options : Boolean(options && options.capture));
  const keyOf = (type, options) => `${type}|${capture(options)}`;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const forget = (target, key, listener) => listeners.get(target)?.get(key)?.delete(listener);

  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    const byKey = listeners.get(this);
    const once = typeof options === 'object' && options !== null && options.once;
    if (byKey && listener && !once) {
      const signal = typeof options === 'object' && options !== null ? options.signal : undefined;
      if (!signal || !signal.aborted) {
        const key = keyOf(type, options);
        if (!byKey.has(key)) byKey.set(key, new Set());
        byKey.get(key).add(listener);
        signal?.addEventListener('abort', () => forget(this, key, listener), { once: true });
      }
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
    if (listeners.has(this)) forget(this, keyOf(type, options), listener);
    return remove.call(this, type, listener, options);
  };

  const observers = { ResizeObserver: new Set(), MutationObserver: new Set(), IntersectionObserver: new Set() };
  let created = 0;
  for (const name of Object.keys(observers)) {
    const Base = window[name];
    if (!Base) continue;
    const live = observers[name];
    const targets = new WeakMap();
    window[name] = class extends Base {
      constructor(callback, options) {
        super(callback, options);
        created += 1;
        targets.set(this, new Set());
      }
      observe(target, options) {
        targets.get(this).add(target);
        live.add(this);
        return super.observe(target, options);
      }
      unobserve(target) {
        const set = targets.get(this);
        set.delete(target);
        if (set.size === 0) live.delete(this);
        return super.unobserve(target);
      }
      disconnect() {
        targets.get(this).clear();
        live.delete(this);
        return super.disconnect();
      }
    };
  }

  // React DevTools hook stand-in.
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
  const PERFORMED_WORK = 1;
  let commits = 0;
  let rendered = 0;
  const countAll = (fiber) => {
    let total = 0;
    for (let node = fiber; node; node = node.sibling) {
      if (COMPONENT_TAGS.has(node.tag)) total += 1;
      total += countAll(node.child);
    }
    return total;
  };
  const countUpdated = (fiber) => {
    let total = 0;
    for (let node = fiber; node; node = node.sibling) {
      const before = node.alternate;
      if (!before) {
        if (COMPONENT_TAGS.has(node.tag)) total += 1;
        total += countAll(node.child);
        continue;
      }
      if (COMPONENT_TAGS.has(node.tag) && node.flags & PERFORMED_WORK) total += 1;
      if (node.child !== before.child) total += countUpdated(node.child);
    }
    return total;
  };
  let renderers = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject() {
      renderers += 1;
      return renderers;
    },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const current = root.current;
      commits += 1;
      rendered += current.alternate ? countUpdated(current.child) : countAll(current.child);
    },
  };

  // Every node in the document, text and comments included, as React splits a
  // label like `Save {index}` into several text nodes.
  const countNodes = () => {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
    let count = 0;
    while (walker.nextNode()) count += 1;
    return count;
  };

  const sum = (byKey) => [...byKey.values()].reduce((total, set) => total + set.size, 0);
  window.__probe = {
    snapshot() {
      return {
        documentListeners: sum(listeners.get(document)),
        windowListeners: sum(listeners.get(window)),
        resizeObservers: observers.ResizeObserver.size,
        mutationObservers: observers.MutationObserver.size,
        intersectionObservers: observers.IntersectionObserver.size,
        observersCreated: created,
        commits,
        rendered,
        nodes: countNodes(),
      };
    },
  };
})();
