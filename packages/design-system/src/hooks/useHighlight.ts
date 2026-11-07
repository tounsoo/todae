import { useLayoutEffect, useState } from 'react';
import { observeMutations } from '../internal/sharedMutations.js';

export type UseHighlightOptions = {
  /** Name to style with ::highlight(name). Hooks that share a name paint together under it. */
  name: string;
  /** Text to find inside the element on ref. A list matches any of its terms; empty strings are skipped. */
  query?: string | readonly string[];
  /** Match letter case exactly. */
  caseSensitive?: boolean;
  /** More ranges to paint, such as the current match. They need no ref and are not added to matches. */
  ranges?: readonly AbstractRange[];
  /** Which highlight paints on top where two overlap. Higher wins. */
  priority?: number;
  /** Highlight type, for spelling and grammar marks. */
  type?: 'highlight' | 'spelling-error' | 'grammar-error';
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

/** One hook's part of a name: what it paints, and the look it asks for. */
type Member = {
  order: number;
  priority: number;
  type: HighlightType;
  matches: readonly AbstractRange[];
  ranges: readonly AbstractRange[];
};

/** One Highlight per name, shared by every hook that uses the name. */
type Shared = { highlight: Highlight; members: Member[] };

// Hooks holding each name, in the order they first mounted. They paint
// together into the name's one Highlight, which goes when the last one leaves.
const shared = /* @__PURE__ */ new Map<string, Shared>();
let mountCount = 0;

/** Repaints the name from every member, in mount order, each in document order. */
function paint(entry: Shared): void {
  entry.highlight.clear();
  for (const member of entry.members) {
    for (const range of member.matches) entry.highlight.add(range);
    for (const range of member.ranges) entry.highlight.add(range);
  }
}

/** A Highlight has one priority and type, so the latest-mounted member sets them. */
function restyle(entry: Shared): void {
  const latest = entry.members.at(-1)!;
  entry.highlight.priority = latest.priority;
  entry.highlight.type = latest.type;
}

function join(name: string, member: Member): void {
  let entry = shared.get(name);
  if (!entry) {
    entry = { highlight: new Highlight(), members: [] };
    shared.set(name, entry);
  }
  entry.members = [...entry.members, member].sort((a, b) => a.order - b.order);
  // The latest-mounted hook claims the name, taking it back from page code that removed or replaced it.
  if (entry.members.at(-1) === member) CSS.highlights.set(name, entry.highlight);
  restyle(entry);
  paint(entry);
}

function leave(name: string, member: Member): void {
  const entry = shared.get(name);
  if (!entry) return;
  entry.members = entry.members.filter((held) => held !== member);
  if (entry.members.length > 0) {
    restyle(entry);
    paint(entry);
    return;
  }
  shared.delete(name);
  // Page code removed or replaced the name since; leave its choice alone.
  if (CSS.highlights.get(name) === entry.highlight) CSS.highlights.delete(name);
}

/** The name's entry, when this member is in it. */
function joined(name: string, member: Member): Shared | undefined {
  const entry = shared.get(name);
  return entry?.members.includes(member) ? entry : undefined;
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
 * `::highlight(name)`; every hook with the same name paints into it.
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
    // One observer for the page, shared with every other watch.
    return observeMutations(node, { subtree: true, childList: true, characterData: true }, (records) => {
      if (search.update(records)) publish();
    }).stop;
  }, [node, source, flags]);

  // The hook's part of its name for its whole life, so its order survives a rename.
  // order is set on the first mount, not at render, so a discarded render doesn't count.
  const [member] = useState<Member | null>(() =>
    supported() ? { order: 0, priority: 0, type: 'highlight', matches: NO_MATCHES, ranges: NO_MATCHES } : null,
  );

  useLayoutEffect(() => {
    if (!member) return;
    if (member.order === 0) member.order = ++mountCount;
    join(name, member);
    return () => leave(name, member);
  }, [member, name]);

  useLayoutEffect(() => {
    if (!member) return;
    member.priority = priority ?? 0;
    member.type = type ?? 'highlight';
    const entry = joined(name, member);
    if (entry) restyle(entry);
  }, [member, name, priority, type]);

  useLayoutEffect(() => {
    if (!member) return;
    const extra = ranges ?? NO_MATCHES;
    // `ranges={[current]}` is a new array each render; skip the repaint when its items are the same.
    if (sameItems(member.matches, matches) && sameItems(member.ranges, extra)) return;
    member.matches = matches;
    member.ranges = extra;
    const entry = joined(name, member);
    if (entry) paint(entry);
  });

  return { ref: setNode, matches };
}
