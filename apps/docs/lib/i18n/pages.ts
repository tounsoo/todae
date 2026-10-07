import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from './config';
import { ENGLISH_PAGES } from './englishPages';

// next.config pageExtensions.
export const PAGE_FILES = ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'].map((ext) => `page.${ext}`);

/** Whether `app/<locale>/<slug>` has a page of its own. Build time only: it reads the file system. */
export function isTranslated(locale: Locale, slug: string, appDir = join(process.cwd(), 'app')): boolean {
  // A wrong working directory would make every page look untranslated, and the fallback would shadow real translations.
  if (!existsSync(join(appDir, locale))) throw new Error(`No ${locale} pages at ${join(appDir, locale)}; build the docs from apps/docs`);
  return PAGE_FILES.some((file) => existsSync(join(appDir, locale, slug, file)));
}

/** English slugs `locale` has no page for yet. Those render the English page. */
export function untranslatedSlugs(locale: Locale, appDir?: string): string[] {
  return Object.keys(ENGLISH_PAGES).filter((slug) => !isTranslated(locale, slug, appDir));
}
