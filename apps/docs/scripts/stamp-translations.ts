// Records that a translated page is up to date with its English page, section by section.
// Run it after updating a translation: pnpm --filter docs i18n:stamp ko badge recipes/combobox
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../lib/i18n/config.ts';
import { sourceRecord, staleSections } from '../lib/i18n/sections.ts';

const app = join(import.meta.dirname, '..', 'app');
const [locale, ...slugs] = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!locale || !(LOCALES as readonly string[]).includes(locale) || locale === DEFAULT_LOCALE || slugs.length === 0) {
  fail(`Usage: pnpm --filter docs i18n:stamp <${LOCALES.filter((item) => item !== DEFAULT_LOCALE).join('|')}> <slug>... (for example: ko badge)`);
}

const file = join(import.meta.dirname, '..', 'lib', 'i18n', 'sources', `${locale as Locale}.json`);
const sources: Record<string, Record<string, string>> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

for (const slug of slugs) {
  const english = join(app, '(en)', slug, 'page.mdx');
  const translated = existsSync(join(app, locale, slug, 'page.mdx'));
  if (!existsSync(english) && !translated && slug in sources) {
    // The page was removed or renamed.
    delete sources[slug];
    console.log(`${locale}/${slug}: dropped`);
    continue;
  }
  if (!existsSync(english)) fail(`No English page.mdx at ${english}`);
  if (!translated) fail(`No ${locale} page at ${join(app, locale, slug, 'page.mdx')}; translate it first`);
  const text = readFileSync(english, 'utf8');
  const stale = staleSections(text, sources[slug]);
  sources[slug] = sourceRecord(text);
  console.log(stale.length ? `${locale}/${slug}: ${stale.join(', ')}` : `${locale}/${slug}: already up to date`);
}

const sorted = Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
