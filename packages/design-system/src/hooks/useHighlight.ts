import { useEffect, useRef, useState } from 'react';

export type HighlightKind = 'highlight' | 'spelling-error' | 'grammar-error';

export type UseHighlightOptions = {
  /** Name to style with ::highlight(name). Hooks that share a name paint into one highlight. */
  name: string;
  /** Text to find inside the element on ref. A list finds every term; empty strings are skipped. */
  query?: string | readonly string[];
  /** Match letter case exactly. */
  caseSensitive?: boolean;
  /** More ranges to paint, such as the current match. They need no ref and are not added to matches. */
  ranges?: readonly AbstractRange[];
  /** Which highlight paints on top where two overlap. Higher wins. Hooks that share a name share it. */
  priority?: number;
  /** Highlight type, for spelling and grammar marks. Hooks that share a name share it. */
  type?: HighlightKind;
};

export type UseHighlightResult = {
  /** Put on the element to search. */
  ref: (node: HTMLElement | null) => void;
  /** Live ranges of every visible match, in document order. */
  matches: readonly Range[];
};

const NO_MATCHES: readonly Range[] = [];

type Entry = { highlight: Highlight; counts: Map<AbstractRange, number> };

// One Highlight per name for the whole page, so hooks that share a name add
// to it instead of replacing each other's ranges in CSS.highlights.
const registry = new Map<string, Entry>();

const supported = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

function addRanges(name: string, ranges: readonly AbstractRange[]): Entry {
  let entry = registry.get(name);
  if (!entry) {
    entry = { highlight: new Highlight(), counts: new Map() };
    registry.set(name, entry);
  }
  // Re-register if page code cleared or replaced the name since.
  if (CSS.highlights.get(name) !== entry.highlight) CSS.highlights.set(name, entry.highlight);
  for (const range of ranges) {
    const count = entry.counts.get(range) ?? 0;
    if (count === 0) entry.highlight.add(range);
    entry.counts.set(range, count + 1);
  }
  return entry;
}

function removeRanges(name: string, entry: Entry, ranges: readonly AbstractRange[]): void {
  for (const range of ranges) {
    const count = entry.counts.get(range) ?? 0;
    if (count <= 1) {
      entry.counts.delete(range);
      entry.highlight.delete(range);
    } else {
      entry.counts.set(range, count - 1);
    }
  }
  if (entry.counts.size > 0 || registry.get(name) !== entry) return;
  registry.delete(name);
  if (CSS.highlights.get(name) === entry.highlight) CSS.highlights.delete(name);
}

const escapeRegExp = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One pattern for every term, longest first so "foobar" wins over "foo". */
function patternSource(query: string | readonly string[] | undefined): string {
  const terms = typeof query === 'string' ? [query] : (query ?? []);
  return [...new Set(terms.filter((term) => term.length > 0))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
}

// `visibility: hidden` text paints nothing, so it counts as hidden too.
const isVisible = (element: Element) => element.checkVisibility?.({ visibilityProperty: true }) ?? true;

function findMatches(root: HTMLElement, pattern: RegExp): Range[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const visible = new Map<Element, boolean>();
  const found: Range[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    // A textarea paints its live value, not its child text.
    if (!parent || parent.localName === 'textarea') continue;
    let shown = visible.get(parent);
    if (shown === undefined) {
      shown = isVisible(parent);
      visible.set(parent, shown);
    }
    if (!shown) continue;
    for (const match of text.data.matchAll(pattern)) {
      const range = doc.createRange();
      range.setStart(text, match.index);
      range.setEnd(text, match.index + match[0].length);
      found.push(range);
    }
  }
  return found;
}

const sameItems = (a: readonly AbstractRange[], b: readonly AbstractRange[]) =>
  a.length === b.length && a.every((range, i) => range === b[i]);

/** Keeps the last array while its items are the same, so `ranges={[current]}` doesn't repaint every render. */
function useStableRanges(ranges: readonly AbstractRange[] | undefined): readonly AbstractRange[] {
  const next = ranges ?? NO_MATCHES;
  const last = useRef(next);
  if (!sameItems(last.current, next)) last.current = next;
  return last.current;
}

function usePaint(name: string, ranges: readonly AbstractRange[]): void {
  useEffect(() => {
    if (!supported() || ranges.length === 0) return;
    const entry = addRanges(name, ranges);
    return () => removeRanges(name, entry, ranges);
  }, [name, ranges]);
}

const sameRanges = (a: readonly Range[], b: readonly Range[]) =>
  a.length === b.length &&
  a.every(
    (range, i) =>
      range.startContainer === b[i]!.startContainer &&
      range.startOffset === b[i]!.startOffset &&
      range.endContainer === b[i]!.endContainer &&
      range.endOffset === b[i]!.endOffset,
  );

/**
 * Paints text matches with the CSS Custom Highlight API: no <mark> elements,
 * so the DOM, selection and focus stay as they are. Style the result with
 * `::highlight(name)`.
 */
export function useHighlight({
  name,
  query,
  caseSensitive = false,
  ranges,
  priority,
  type,
}: UseHighlightOptions): UseHighlightResult {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [matches, setMatches] = useState<readonly Range[]>(NO_MATCHES);
  const source = patternSource(query);
  const flags = caseSensitive ? 'gu' : 'giu';

  useEffect(() => {
    if (!node || source === '') {
      setMatches(NO_MATCHES);
      return;
    }
    const pattern = new RegExp(source, flags);
    const search = () => {
      const next = findMatches(node, pattern);
      setMatches((prev) => (sameRanges(prev, next) ? prev : next.length === 0 ? NO_MATCHES : next));
    };
    search();
    const observer = new MutationObserver(search);
    observer.observe(node, {
      subtree: true,
      childList: true,
      characterData: true,
      // Only the attributes that commonly show or hide text.
      attributeFilter: ['hidden', 'class', 'style', 'open'],
    });
    return () => observer.disconnect();
  }, [node, source, flags]);

  const extra = useStableRanges(ranges);
  usePaint(name, matches);
  usePaint(name, extra);

  // Hooks that share a name share one Highlight, so only a value passed in is
  // set. Runs after painting, which creates the Highlight when it is missing.
  useEffect(() => {
    const highlight = registry.get(name)?.highlight;
    if (!highlight) return;
    if (priority !== undefined) highlight.priority = priority;
    if (type !== undefined) highlight.type = type;
  }, [name, priority, type, matches, extra]);

  return { ref: setNode, matches };
}
