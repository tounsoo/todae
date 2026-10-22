import { createHash } from 'node:crypto';
import type { Node } from 'mdast';
import { parseMdx as parse } from '../mdxAst';

/** One part of an MDX page: a heading and what follows it, up to the next heading. */
export type Section = {
  heading: string;
  level: number;
  text: string;
  /** Paragraphs, lists, demos and other top-level blocks after the heading, not counting code blocks. */
  blocks: number;
};

/** The key of the part before a page's first heading, usually its imports. */
export const TOP = '(top)';

/** The key of the fingerprint of a page's headings in order, so moving a section is a change. */
export const ORDER = '(section order)';

const start = (node: Node) => node.position!.start.offset!;
const end = (node: Node) => node.position!.end.offset!;

/** `mdx` split at its top-level headings, as the MDX compiler parses them. */
export function sections(mdx: string): Section[] {
  const parts: Section[] = [{ heading: TOP, level: 0, text: '', blocks: 0 }];
  const starts = [0];
  for (const node of parse(mdx).children) {
    if (node.type === 'heading') {
      parts.push({ heading: mdx.slice(start(node), end(node)).trim(), level: node.depth, text: '', blocks: 0 });
      starts.push(start(node));
    } else if (node.type !== 'code') {
      parts.at(-1)!.blocks++;
    }
  }
  parts.forEach((part, index) => (part.text = mdx.slice(starts[index], starts[index + 1] ?? mdx.length)));
  return parts.filter((part) => part.level > 0 || part.text.trim() !== '');
}

/**
 * The target of every Markdown link and link definition in `mdx`, and every JSX `href` attribute
 * (an expression as `{…}`), sorted. Link text and titles are left out, since a translation changes them.
 */
export function links(mdx: string): string[] {
  const found: string[] = [];
  const visit = (node: Node) => {
    if (node.type === 'link' || node.type === 'definition') found.push((node as Node & { url: string }).url);
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      for (const attribute of (node as Node & { attributes: { type: string; name?: string; value?: unknown }[] }).attributes) {
        if (attribute.type !== 'mdxJsxAttribute' || attribute.name !== 'href') continue;
        const { value } = attribute;
        found.push(typeof value === 'string' ? value : `{${(value as { value?: string } | null)?.value ?? ''}}`);
      }
    }
    if ('children' in node) for (const child of node.children as Node[]) visit(child);
  };
  visit(parse(mdx));
  return found.sort();
}

function fingerprint(text: string): string {
  const normalized = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

/**
 * Each section of an English page by heading, with a fingerprint of its text, plus the
 * fingerprint of the headings' order under `ORDER`. Repeated headings get ` (2)`, ` (3)` and so on.
 */
export function sourceRecord(english: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { heading, text } of sections(english)) {
    let key = heading;
    for (let n = 2; Object.hasOwn(record, key); n++) key = `${heading} (${n})`;
    record[key] = fingerprint(text);
  }
  record[ORDER] = fingerprint(Object.keys(record).join('\n'));
  return record;
}

/**
 * The sections whose English differs from what a translation was made from: changed, new or
 * gone since, and `section order (changed)` when the order of headings differs from the record.
 * Empty when the English is what was last stamped.
 */
export function staleSections(english: string, recorded: Record<string, string> | undefined, current = sourceRecord(english)): string[] {
  const before = recorded ?? {};
  const headings = Object.keys(current).filter((heading) => heading !== ORDER);
  const changed = headings
    .filter((heading) => before[heading] !== current[heading])
    .map((heading) => (Object.hasOwn(before, heading) ? `${heading} (changed)` : `${heading} (new)`));
  const removed = Object.keys(before)
    .filter((heading) => heading !== ORDER && !Object.hasOwn(current, heading))
    .map((heading) => `${heading} (removed)`);
  // Adding or removing a section changes the order too, so this line can repeat one above it.
  const order = recorded && before[ORDER] !== current[ORDER] ? ['section order (changed)'] : [];
  return [...changed, ...removed, ...order];
}
