// jsdom has no transient observers: a browser's observer keeps hearing a
// subtree removed from a target it watches until its next report, unless it
// observes that target again or disconnects. This adds them to jsdom's nodes
// for these tests, as the DOM spec and Chromium have them.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { observeMutations } from './sharedMutations.js';

type Impl = {
  _registeredObserverList: Registration[];
  parentNode: Impl | null;
  _remove: (node: Impl, suppress?: boolean) => void;
};
type Registration = { observer: { _nodeList: Impl[] }; options: { subtree?: boolean }; source?: Registration };

let undo = () => {};
beforeAll(() => {
  const key = Object.getOwnPropertySymbols(document.body).find((symbol) => symbol.description === 'impl')!;
  let proto = Object.getPrototypeOf((document.body as unknown as Record<symbol, Impl>)[key]);
  while (!Object.prototype.hasOwnProperty.call(proto, '_remove')) proto = Object.getPrototypeOf(proto);
  const original = proto._remove;
  const keep = (parent: Impl, node: Impl) => {
    for (let at: Impl | null = parent; at; at = at.parentNode)
      for (const registration of at._registeredObserverList)
        if (registration.options.subtree && !registration.source) {
          node._registeredObserverList.push({ ...registration, source: registration });
          registration.observer._nodeList.push(node);
        }
  };
  proto._remove = function (this: Impl, node: Impl, suppress?: boolean) {
    original.call(this, node, suppress);
    keep(this, node);
  };
  undo = () => (proto._remove = original);
});
afterAll(() => undo());

const kinds = (records: MutationRecord[]) =>
  records.map((record) => (record.type === 'attributes' ? `attr:${record.attributeName}` : record.type));
const WATCH = { childList: true, subtree: true, attributes: true } as const;

// What an observer of its own hears when `between` runs after `child` leaves `root`, against the shared listener.
function compare(between: (root: Element) => () => () => void) {
  const root = document.createElement('div');
  const child = document.createElement('div');
  root.append(child);
  const own = new MutationObserver(() => {});
  own.observe(root, WATCH);
  const shared = observeMutations(root, WATCH, () => {});
  const before = between(root);
  child.remove();
  const after = before();
  child.title = 'x';
  const heard = { own: kinds(own.takeRecords()), shared: kinds(shared.take()) };
  after();
  shared.stop();
  own.disconnect();
  return heard;
}
const both = { own: ['childList', 'attr:title'], shared: ['childList', 'attr:title'] };

describe('observeMutations with transient observers', () => {
  it('hears a change inside a subtree just removed from its target', () => {
    expect(compare(() => () => () => {})).toEqual(both);
  });

  it('still hears it after another listener on the target starts with wider options', () => {
    expect(
      compare((root) => () => {
        const wider = observeMutations(root, { subtree: true, characterData: true }, () => {});
        return wider.stop;
      }),
    ).toEqual(both);
  });

  it('still hears it after another listener on the target stops and the options narrow', () => {
    expect(
      compare((root) => {
        const wider = observeMutations(root, { subtree: true, characterData: true }, () => {});
        return () => {
          wider.stop();
          return () => {};
        };
      }),
    ).toEqual(both);
  });

  it('still hears it after the observer starts over once most targets are dropped', () => {
    expect(
      compare(() => {
        const others = [1, 2, 3].map(() => observeMutations(document.createElement('div'), { childList: true }, () => {}));
        return () => {
          // The third stop starts the observer over.
          for (const other of others) other.stop();
          return () => {};
        };
      }),
    ).toEqual(both);
  });
});
