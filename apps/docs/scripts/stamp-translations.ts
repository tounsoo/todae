// Records that a translated page is up to date with its English page, section by section.
// Run it after updating a translation: pnpm --filter docs i18n:stamp ko badge recipes/combobox
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n/config.ts';
import { stamp, type Sources } from '../lib/i18n/stamp.ts';

const [locale, ...slugs] = process.argv.slice(2);

if (!locale || !(LOCALES as readonly string[]).includes(locale) || locale === DEFAULT_LOCALE || slugs.length === 0) {
  console.error(`Usage: pnpm --filter docs i18n:stamp <${LOCALES.filter((item) => item !== DEFAULT_LOCALE).join('|')}> <slug>... (for example: ko badge)`);
  process.exit(1);
}

const file = join(import.meta.dirname, '..', 'lib', 'i18n', 'sources', `${locale}.json`);
const before: Sources = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
try {
  const { sources, log } = stamp(join(import.meta.dirname, '..', 'app'), locale, before, slugs);
  writeFileSync(file, `${JSON.stringify(sources, null, 2)}\n`);
  for (const line of log) console.log(line);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
