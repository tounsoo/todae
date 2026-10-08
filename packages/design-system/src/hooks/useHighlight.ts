import { useLayoutEffect, useRef, useState } from 'react';

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

/** Keeps matches per text node, so a change only rescans the text it touched, not the whole element. */
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
  const eachText = (node: Node, visit: (text: Text) => void) => {
    if (node.nodeType === Node.TEXT_NODE) return visit(node as Text);
    const walker = root.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) visit(text as Text);
  };
  const forget = (text: Text) => {
    if (!root.contains(text) && byText.delete(text)) changed = true;
  };
  const scan = (node: Node) => eachText(node, scanText);
  /** Applies a mutation batch; returns whether any match changed. */
  const update = (records: readonly MutationRecord[]): boolean => {
    changed = false;
    for (const record of records) {
      if (record.type === 'characterData') {
        if (root.contains(record.target)) scan(record.target);
        else eachText(record.target, forget);
        continue;
      }
      for (const removed of record.removedNodes) eachText(removed, forget);
      for (const added of record.addedNodes) if (root.contains(added)) scan(added);
    }
    return changed;
  };
  const matches = () => [...byText.keys()].sort(inDocumentOrder).flatMap((text) => byText.get(text)!);
  scan(root);
  return { update, matches };
}

type Holder = { highlight: Highlight; order: number };

// Hooks holding each name, in the order they first mounted. The latest-mounted
// one is registered; when it unmounts, the one before it takes the name back.
const holders = new Map<string, Holder[]>();
let mountCount = 0;

function claim(name: string, holder: Holder): void {
  const list = [...(holders.get(name) ?? []), holder].sort((a, b) => a.order - b.order);
  holders.set(name, list);
  if (list.at(-1) === holder) CSS.highlights.set(name, holder.highlight);
}

function release(name: string, holder: Holder): void {
  const list = (holders.get(name) ?? []).filter((held) => held !== holder);
  if (list.length > 0) holders.set(name, list);
  else holders.delete(name);
  // Page code removed or replaced the name since; leave its choice alone.
  if (CSS.highlights.get(name) !== holder.highlight) return;
  const previous = list.at(-1);
  if (previous) CSS.highlights.set(name, previous.highlight);
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

  useLayoutEffect(() => {
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
  // order is set on the first mount, not at render, so a discarded render doesn't count.
  const [holder] = useState<Holder | null>(() => (supported() ? { highlight: new Highlight(), order: 0 } : null));
  const highlight = holder?.highlight ?? null;
  const painted = useRef<{ matches: readonly AbstractRange[]; ranges: readonly AbstractRange[] }>({
    matches: NO_MATCHES,
    ranges: NO_MATCHES,
  });

  useLayoutEffect(() => {
    if (!holder) return;
    if (holder.order === 0) holder.order = ++mountCount;
    claim(name, holder);
    return () => release(name, holder);
  }, [holder, name]);

  useLayoutEffect(() => {
    if (!highlight) return;
    highlight.priority = priority ?? 0;
    highlight.type = type ?? 'highlight';
  }, [highlight, priority, type]);

  useLayoutEffect(() => {
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
