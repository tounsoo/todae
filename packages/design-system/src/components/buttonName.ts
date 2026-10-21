import { isValidElement, useCallback, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useComposedRefs } from './props.js';

/**
 * Two or more letters or digits name the button, such as "Got it" or "닫기";
 * a symbol such as × or a lone "x" glyph does not.
 */
function isWorded(text: string): boolean {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2;
}

function hasWords(children: ReactNode): boolean {
  if (typeof children === 'string' || typeof children === 'number') return isWorded(String(children));
  if (Array.isArray(children)) return children.some(hasWords);
  if (isValidElement<{ children?: ReactNode; 'aria-hidden'?: unknown }>(children)) {
    // Like spokenText: SVG text, such as a <title>, does not count.
    if (children.type === 'svg') return false;
    const hidden = children.props['aria-hidden'];
    return hidden !== true && hidden !== 'true' && hasWords(children.props.children);
  }
  return false;
}

/** The text a screen reader reads from the button's content: not aria-hidden parts or SVG titles. */
export function spokenText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.namespaceURI === 'http://www.w3.org/2000/svg') {
    return '';
  }
  return [...node.childNodes].map(spokenText).join('');
}

type Watched = [Element, MutationObserverInit][];

/**
 * Calls `onChange` when any of the elements `find` returns changes as its
 * options say. The elements are found again after each change, so a replaced
 * one is followed; `refresh` finds them again on demand. Returns both, and
 * the cleanup. Without MutationObserver it does nothing.
 */
function watchElements(find: () => Watched, onChange: () => void) {
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
    onChange();
    refresh();
  });
  function refresh() {
    if (!observer) return;
    observer.disconnect();
    for (const [element, options] of find()) observer.observe(element, options);
  }
  refresh();
  return { refresh, stop: () => observer?.disconnect() };
}

const BUTTON_CHANGES: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-hidden'],
};

/**
 * The accessible name for a button that Todae names, such as a dismiss or step
 * button: `ariaLabel` when not empty, none when the button's own rendered text
 * names it, and `fallback`, a string from StringsProvider, otherwise. Put the
 * returned ref on the button.
 */
export function useButtonName(
  children: ReactNode,
  ariaLabel: string | undefined,
  ref: Ref<HTMLButtonElement> | undefined,
  fallback: string,
): [string | undefined, Ref<HTMLButtonElement>] {
  // The rendered text decides, so a component that renders text (such as a
  // translation) names the button too. The children are a first guess for SSR.
  const [worded, setWorded] = useState(() => hasWords(children));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(buttonRef, ref);
  const read = useCallback(() => {
    const button = buttonRef.current;
    setWorded(button ? isWorded(spokenText(button)) : false);
  }, []);
  // Every commit, as the text can change; the same value bails out.
  useLayoutEffect(read);
  // A child can render its text from its own state, such as a translation
  // that loads later, without this component rendering again.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    return watchElements(() => [[button, BUTTON_CHANGES]], read).stop;
  }, [read]);
  return [ariaLabel || (worded ? undefined : fallback), refs];
}

/** What names an input, from its own attributes: the elements its `aria-labelledby` points at, else its `aria-label`, else its `<label>`s. Empty without one. */
export function labelOf(input: HTMLInputElement | null): string {
  if (!input) return '';
  const ids = input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  const own = input.getAttribute('aria-label');
  const spoken = ids.length
    ? ids.map((id) => spokenText(input.ownerDocument.getElementById(id) ?? input.ownerDocument.createTextNode(''))).join(' ')
    : own || [...(input.labels ?? [])].map(spokenText).join(' ');
  return spoken.replace(/\s+/g, ' ').trim();
}

// What names an input: its `aria-labelledby` elements, else its `<label>`s.
function namedBy(input: HTMLInputElement): Element[] {
  const ids = input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  return ids.length ? ids.flatMap((id) => input.ownerDocument.getElementById(id) ?? []) : [...(input.labels ?? [])];
}

type Watch = { input: HTMLInputElement; onChange: (label: string) => void; named: Element[] };
type Registry = { observer: MutationObserver; watches: Set<Watch> };
const registries = new WeakMap<Document, Registry>();

const idsOf = (input: HTMLInputElement) => input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];

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
  let registry: Registry | undefined;
  if (typeof MutationObserver !== 'undefined') {
    const document = input.ownerDocument;
    registry = registries.get(document);
    if (!registry) {
      const created: Registry = { observer: new MutationObserver((records) => handle(created, records)), watches: new Set() };
      created.observer.observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'aria-labelledby', 'aria-hidden', 'for', 'id'],
        attributeOldValue: true,
      });
      registries.set(document, created);
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
        registries.delete(input.ownerDocument);
      }
    },
  };
}
