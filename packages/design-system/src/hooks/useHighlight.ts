import { useEffect, useRef, useState } from 'react';

export type UseHighlightOptions = {
  /** Name to style with ::highlight(name). Give each hook its own name. */
  name: string;
  /** Text to find inside the element on ref. A list finds every term; empty strings are skipped. */
  query?: string | readonly string[];
  /** Match letter case exactly. */
  caseSensitive?: boolean;
  /** More ranges to paint, such as the current match. They need no ref and are not added to matches. */
  ranges?: readonly AbstractRange[];
  /** Which highlight paints on top where two overlap. Higher wins. */
  priority?: number;
  /** Highlight type, for spelling and grammar marks. */
  type?: HighlightType;
};

export type UseHighlightResult = {
  /** Put on the element to search. */
  ref: (node: HTMLElement | null) => void;
  /** Live ranges of every match, in document order. */
  matches: readonly Range[];
};

const NO_MATCHES: readonly Range[] = [];

const supported = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

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

  // One Highlight for the hook's whole life, so its priority and type survive
  // every change of ranges.
  const [highlight] = useState(() => (supported() ? new Highlight() : null));
  const painted = useRef<{ matches: readonly AbstractRange[]; ranges: readonly AbstractRange[] }>({
    matches: NO_MATCHES,
    ranges: NO_MATCHES,
  });

  useEffect(() => {
    if (!highlight) return;
    CSS.highlights.set(name, highlight);
    return () => {
      // A later hook may have taken the name; leave it alone.
      if (CSS.highlights.get(name) === highlight) CSS.highlights.delete(name);
    };
  }, [highlight, name]);

  useEffect(() => {
    if (!highlight) return;
    highlight.priority = priority ?? 0;
    highlight.type = type ?? 'highlight';
  }, [highlight, priority, type]);

  useEffect(() => {
    if (!highlight) return;
    const extra = ranges ?? NO_MATCHES;
    const last = painted.current;
    // Re-register if page code removed the name since, but not over a later hook.
    const missing = !CSS.highlights.has(name);
    if (missing) CSS.highlights.set(name, highlight);
    // `ranges={[current]}` is a new array each render; skip the repaint when its items are the same.
    if (!missing && sameItems(last.matches, matches) && sameItems(last.ranges, extra)) return;
    highlight.clear();
    for (const range of matches) highlight.add(range);
    for (const range of extra) highlight.add(range);
    painted.current = { matches, ranges: extra };
  });

  return { ref: setNode, matches };
}
