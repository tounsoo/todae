import { createHash } from 'node:crypto';

/** One part of an MDX page: a heading and what follows it, up to the next heading. */
export type Section = { heading: string; level: number; text: string };

/** The key of the part before a page's first heading, usually its imports. */
export const TOP = '(top)';

/** `mdx` split at its headings. A `#` line inside a code fence is not a heading. */
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

/** Each section of an English page by heading, with a fingerprint of its text. A repeated heading gets a ` (2)` suffix. */
export function sourceRecord(english: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { heading, text } of sections(english)) {
    let key = heading;
    for (let n = 2; key in record; n++) key = `${heading} (${n})`;
    record[key] = fingerprint(text);
  }
  return record;
}

/**
 * The sections whose English differs from what a translation was made from: changed or new
 * in English since, or gone from it. Empty when the translation is up to date.
 */
export function staleSections(english: string, recorded: Record<string, string> | undefined): string[] {
  const current = sourceRecord(english);
  const before = recorded ?? {};
  return [
    ...Object.entries(current)
      .filter(([heading, hash]) => before[heading] !== hash)
      .map(([heading]) => (heading in before ? `${heading} (changed)` : `${heading} (new)`)),
    ...Object.keys(before)
      .filter((heading) => !(heading in current))
      .map((heading) => `${heading} (removed)`),
  ];
}
