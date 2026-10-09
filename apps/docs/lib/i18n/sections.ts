import { createHash } from 'node:crypto';

/** One part of an MDX page: a heading and what follows it, up to the next heading. */
export type Section = { heading: string; level: number; text: string };

/** The key of the part before a page's first heading, usually its imports. */
export const TOP = '(top)';

/** The key of the fingerprint of a page's headings in order, so moving a section is a change. */
export const ORDER = '(section order)';

/** `mdx` split at its headings. A `#` line inside a backtick code fence is not a heading. */
export function sections(mdx: string): Section[] {
  const parts: Section[] = [{ heading: TOP, level: 0, text: '' }];
  let fenced = false;
  for (const line of mdx.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,6}) /.exec(line);
    if (heading) parts.push({ heading: line.trim(), level: heading[1]!.length, text: '' });
    const part = parts.at(-1)!;
    part.text += `${line}\n`;
  }
  return parts.filter((part) => part.level > 0 || part.text.trim() !== '');
}

/** The blank-line separated blocks of a section outside its code fences, which a translation keeps one for one. */
export function blocks(text: string): number {
  const prose = text.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, '');
  return prose.split(/\n\s*\n/).filter((block) => block.trim() !== '').length;
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
 * fingerprint of the headings' order under `ORDER`. A repeated heading gets a ` (2)` suffix.
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
