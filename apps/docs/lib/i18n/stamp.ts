import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, sep } from 'node:path';
import { sourceRecord, staleSections } from './sections.ts';

export type Sources = Record<string, Record<string, string>>;

/**
 * `sources` with each slug's record set to the current English, for `pnpm --filter docs i18n:stamp`,
 * and a line per slug saying what changed. A recorded slug whose English and translated pages are both
 * gone has its record dropped. Throws, changing nothing, for any other slug that is not the folder of an
 * `app/<locale>` page.mdx exactly as the file system lists it, or that has no English page.mdx.
 */
export function stamp(appDir: string, locale: string, sources: Sources, slugs: readonly string[]): { sources: Sources; log: string[] } {
  const next: Sources = { ...sources };
  const log: string[] = [];
  // The translated pages by folder, as the tests list them, so a slug names a page in one spelling only.
  const translated = new Set(
    readdirSync(join(appDir, locale), { recursive: true, encoding: 'utf8' })
      .filter((file) => basename(file) === 'page.mdx')
      .map((file) => dirname(file).split(sep).join('/')),
  );
  for (const slug of slugs) {
    const english = join(appDir, '(en)', slug, 'page.mdx');
    if (!translated.has(slug)) {
      if (Object.hasOwn(next, slug) && !existsSync(english)) {
        // The page was removed or renamed.
        delete next[slug];
        log.push(`${locale}/${slug}: dropped`);
        continue;
      }
      throw new Error(`No ${locale} page.mdx for ${slug}; translate it first, and write the slug as in the URL, such as recipes/combobox`);
    }
    if (!existsSync(english)) throw new Error(`No English page.mdx at ${english}`);
    const text = readFileSync(english, 'utf8');
    const record = sourceRecord(text);
    const stale = staleSections(text, next[slug], record);
    next[slug] = record;
    log.push(stale.length ? `${locale}/${slug}: ${stale.join(', ')}` : `${locale}/${slug}: already up to date`);
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { sources: sorted, log };
}
