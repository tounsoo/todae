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

function rangesIn(text: Text, pattern: RegExp): Range[] {
  const found: Range[] = [];
  for (const match of text.data.matchAll(pattern)) {
    const range = text.ownerDocument.createRange();
    range.setStart(text, match.index);
    range.setEnd(text, match.index + match[0].length);
    found.push(range);
  }
  return found;
}

const inDocumentOrder = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

/**
 * Keeps matches per text node, so a change only rescans the text it touched
 * instead of the whole element: text streaming into a long page stays cheap.
 */
function createSearch(root: HTMLElement, pattern: RegExp) {
  const byText = new Map<Text, Range[]>();
  let changed = false;
  const scanText = (text: Text) => {
    const found = rangesIn(text, pattern);
    if (found.length > 0) {
      byText.set(text, found);
      changed = true;
    } else if (byText.delete(text)) {
      changed = true;
    }
  };
  const scan = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return scanText(node as Text);
    const walker = root.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) scanText(text as Text);
  };
  /** Applies a mutation batch; returns whether any match changed. */
  const update = (records: readonly MutationRecord[]): boolean => {
    changed = false;
    let removed = false;
    for (const record of records) {
      if (record.type === 'characterData') {
        if (root.contains(record.target)) scan(record.target);
        else removed = true;
        continue;
      }
      if (record.removedNodes.length > 0) removed = true;
      for (const added of record.addedNodes) if (root.contains(added)) scan(added);
    }
    if (removed) {
      for (const text of byText.keys()) {
        if (root.contains(text)) continue;
        byText.delete(text);
        changed = true;
      }
    }
    return changed;
  };
  const matches = () => [...byText.keys()].sort(inDocumentOrder).flatMap((text) => byText.get(text)!);
  scan(root);
  return { update, matches };
}

// Hooks holding each name, oldest first. The newest is registered; when it
// unmounts, the one before it takes the name back.
const holders = new Map<string, Highlight[]>();

function claim(name: string, highlight: Highlight): void {
  const list = holders.get(name) ?? [];
  list.push(highlight);
  holders.set(name, list);
  CSS.highlights.set(name, highlight);
}

function release(name: string, highlight: Highlight): void {
  const list = (holders.get(name) ?? []).filter((held) => held !== highlight);
  if (list.length > 0) holders.set(name, list);
  else holders.delete(name);
  // Page code removed or replaced the name since; leave its choice alone.
  if (CSS.highlights.get(name) !== highlight) return;
  const previous = list.at(-1);
  if (previous) CSS.highlights.set(name, previous);
  else CSS.highlights.delete(name);
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
    const search = createSearch(node, new RegExp(source, flags));
    const publish = () => {
      const next = search.matches();
      setMatches((prev) => (sameRanges(prev, next) ? prev : next.length === 0 ? NO_MATCHES : next));
    };
    publish();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((records) => {
      if (search.update(records)) publish();
    });
    observer.observe(node, { subtree: true, childList: true, characterData: true });
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
    claim(name, highlight);
    return () => release(name, highlight);
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
    // `ranges={[current]}` is a new array each render; skip the repaint when its items are the same.
    if (sameItems(last.matches, matches) && sameItems(last.ranges, extra)) return;
    highlight.clear();
    for (const range of matches) highlight.add(range);
    for (const range of extra) highlight.add(range);
    painted.current = { matches, ranges: extra };
  });

  return { ref: setNode, matches };
}
