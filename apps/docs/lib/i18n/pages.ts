import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from './config';
import { ENGLISH_PAGES } from './englishPages';

// next.config pageExtensions.
const PAGE_FILES = ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'].map((ext) => `page.${ext}`);

/** Whether `app/<locale>/<slug>` has a page of its own. Build time only: it reads the file system. */
export function isTranslated(locale: Locale, slug: string, appDir = join(process.cwd(), 'app')): boolean {
  return PAGE_FILES.some((file) => existsSync(join(appDir, locale, slug, file)));
}

/** English slugs `locale` has no page for yet. Those render the English page. */
export function untranslatedSlugs(locale: Locale, appDir?: string): string[] {
  return Object.keys(ENGLISH_PAGES).filter((slug) => !isTranslated(locale, slug, appDir));
}
