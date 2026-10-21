import { spokenText } from './buttonName.js';

// The tree an input's ids are looked up in: its document, or the shadow root it sits in.
const rootOf = (input: HTMLInputElement): Document | ShadowRoot | Node => input.getRootNode();

const idsOf = (input: HTMLInputElement) => input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];

// The elements its `aria-labelledby` points at that exist, found in its own root.
function referenced(input: HTMLInputElement): Element[] {
  const root = rootOf(input);
  const find = 'getElementById' in root ? (id: string) => (root as Document | ShadowRoot).getElementById(id) : (id: string) => input.ownerDocument.getElementById(id);
  return idsOf(input).flatMap((id) => find(id) ?? []);
}

// Every element that can name an input, to watch: the ones its `aria-labelledby` points at, and its `<label>`s.
const namedBy = (input: HTMLInputElement): Element[] => [...referenced(input), ...(input.labels ?? [])];

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const textOf = (elements: Iterable<Element>) => squash([...elements].map(spokenText).join(' '));

/** What names an input, as accessible name computation does: the text of the elements its `aria-labelledby` points at, when there is some, else its `aria-label`, else its `<label>`s. Empty without one. */
export function labelOf(input: HTMLInputElement | null): string {
  if (!input) return '';
  return textOf(referenced(input)) || squash(input.getAttribute('aria-label') ?? '') || textOf(input.labels ?? []);
}

type Watch = { input: HTMLInputElement; onChange: (label: string) => void; named: Element[] };
type Registry = { observer: MutationObserver; watches: Set<Watch> };
const registries = new WeakMap<Node, Registry>();

// Whether a node that came or went is, or holds, a label, or an element an `aria-labelledby` names: only these can change which elements name an input.
function touchesLabels(node: Node, ids: Set<string>): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  if (element.localName === 'label' || element.querySelector('label')) return true;
  if (!ids.size) return false;
  return ids.has(element.id) || [...element.querySelectorAll('[id]')].some((inner) => ids.has(inner.id));
}

function read(watch: Watch) {
  watch.named = namedBy(watch.input);
  watch.onChange(labelOf(watch.input));
}

function handle(registry: Registry, records: MutationRecord[]) {
  const { watches } = registry;
  const ids = new Set([...watches].flatMap((watch) => idsOf(watch.input)));
  let structural = false;
  const dirty = new Set<Watch>();
  for (const record of records) {
    if (record.type === 'childList') {
      structural ||= [...record.addedNodes, ...record.removedNodes].some((node) => touchesLabels(node, ids));
    } else if (record.type === 'attributes' && (record.attributeName === 'for' || record.attributeName === 'id')) {
      // A label that is pointed elsewhere, or an element that takes or loses an id, can name a different input.
      const element = record.target as Element;
      structural ||= element.localName === 'label' || ids.has(element.id) || ids.has(record.oldValue ?? '');
    }
    // A change in a naming element, or in the input's own naming attributes, is for the inputs it names.
    const target = record.target.nodeType === 1 ? (record.target as Element) : record.target.parentElement;
    for (const watch of watches) {
      if (record.type === 'attributes' && record.target === watch.input) dirty.add(watch);
      else if (watch.named.some((element) => target && element.contains(target))) dirty.add(watch);
    }
  }
  // Only the inputs whose naming elements changed or are now others read their label again.
  for (const watch of watches) {
    if (dirty.has(watch)) read(watch);
    else if (structural) {
      const next = namedBy(watch.input);
      if (next.length !== watch.named.length || next.some((element, index) => element !== watch.named[index])) read(watch);
    }
  }
}

/**
 * Calls `onChange` with the input's label text now and whenever it changes: its
 * `<label>`s or the elements its `aria-labelledby` names, as their text or
 * attributes change, and the input's own `aria-label` and `aria-labelledby`.
 * One observer per document, shared by every watched input, finds out when a
 * label mounts, is replaced or goes anywhere in the page, so the label is
 * followed with no render of the input. It reads again only the inputs whose
 * naming elements changed, and only when an added or removed node is, or holds,
 * a label or an element an `aria-labelledby` names, so unrelated changes to
 * the page cost no label read. `stop` ends the watch.
 */
export function watchLabel(input: HTMLInputElement | null, onChange: (label: string) => void): { stop: () => void } {
  if (!input) return { stop: () => {} };
  const watch: Watch = { input, onChange, named: namedBy(input) };
  const root = rootOf(input);
  let registry: Registry | undefined;
  if (typeof MutationObserver !== 'undefined') {
    registry = registries.get(root);
    if (!registry) {
      const created: Registry = { observer: new MutationObserver((records) => handle(created, records)), watches: new Set() };
      created.observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'aria-labelledby', 'aria-hidden', 'for', 'id'],
        attributeOldValue: true,
      });
      registries.set(root, created);
      registry = created;
    }
    registry.watches.add(watch);
  }
  onChange(labelOf(input));
  return {
    stop: () => {
      if (!registry) return;
      registry.watches.delete(watch);
      if (!registry.watches.size) {
        registry.observer.disconnect();
        registries.delete(root);
      }
    },
  };
}
