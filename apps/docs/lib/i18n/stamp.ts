import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { sourceRecord, staleSections } from './sections.ts';

export type Sources = Record<string, Record<string, string>>;

/**
 * `sources` with each slug's record set to the current English, for `pnpm --filter docs i18n:stamp`,
 * and a line per slug saying what changed. A slug whose English and translated pages are both gone
 * has its record dropped. Throws, changing nothing, for any other slug that lacks either `page.mdx`, and for a
 * slug not written as in the URL.
 */
export function stamp(appDir: string, locale: string, sources: Sources, slugs: readonly string[]): { sources: Sources; log: string[] } {
  const next: Sources = { ...sources };
  const log: string[] = [];
  for (const slug of slugs) {
    if (slug === '' || slug !== posix.normalize(slug) || /^(\.|\/)|\/$|(^|\/)\.\.(\/|$)/.test(slug)) {
      throw new Error(`Write the slug as in the URL, such as recipes/combobox, not ${slug}`);
    }
    const english = join(appDir, '(en)', slug, 'page.mdx');
    const translation = join(appDir, locale, slug, 'page.mdx');
    if (!existsSync(english) && !existsSync(translation) && Object.hasOwn(next, slug)) {
      // The page was removed or renamed.
      delete next[slug];
      log.push(`${locale}/${slug}: dropped`);
      continue;
    }
    if (!existsSync(english)) throw new Error(`No English page.mdx at ${english}`);
    if (!existsSync(translation)) throw new Error(`No ${locale} page at ${translation}; translate it first`);
    const text = readFileSync(english, 'utf8');
    const record = sourceRecord(text);
    const stale = staleSections(text, next[slug], record);
    next[slug] = record;
    log.push(stale.length ? `${locale}/${slug}: ${stale.join(', ')}` : `${locale}/${slug}: already up to date`);
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { sources: sorted, log };
}
