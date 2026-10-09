import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceRecord, staleSections } from './sections.ts';

export type Sources = Record<string, Record<string, string>>;

/**
 * `sources` with each slug's record set to the current English, for `pnpm --filter docs i18n:stamp`,
 * and a line per slug saying what changed. A slug whose translated page is gone has its record
 * dropped. Throws, changing nothing, when a slug has no English `page.mdx` or no translation.
 */
export function stamp(appDir: string, locale: string, sources: Sources, slugs: readonly string[]): { sources: Sources; log: string[] } {
  const next: Sources = { ...sources };
  const log: string[] = [];
  for (const slug of slugs) {
    const english = join(appDir, '(en)', slug, 'page.mdx');
    const translation = join(appDir, locale, slug, 'page.mdx');
    if (!existsSync(translation) && Object.hasOwn(next, slug)) {
      // The page was removed or renamed.
      delete next[slug];
      log.push(`${locale}/${slug}: dropped`);
      continue;
    }
    if (!existsSync(english)) throw new Error(`No English page.mdx at ${english}`);
    if (!existsSync(translation)) throw new Error(`No ${locale} page at ${translation}; translate it first`);
    const text = readFileSync(english, 'utf8');
    const stale = staleSections(text, next[slug]);
    next[slug] = sourceRecord(text);
    log.push(stale.length ? `${locale}/${slug}: ${stale.join(', ')}` : `${locale}/${slug}: already up to date`);
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { sources: sorted, log };
}
