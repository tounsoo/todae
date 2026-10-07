import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LOCALE, LOCALES, type Locale } from './config';
import { ENGLISH_PAGES } from './englishPages';

// next.config pageExtensions.
export const PAGE_FILES = ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'].map((ext) => `page.${ext}`);

/** Whether `app/<locale>/<slug>` has a page of its own. Build time only: it reads the file system. */
export function isTranslated(locale: Locale, slug: string, appDir = join(process.cwd(), 'app')): boolean {
  return PAGE_FILES.some((file) => existsSync(join(appDir, locale, slug, file)));
}

/** English slugs `locale` has no page for yet. Those render the English page. */
export function untranslatedSlugs(locale: Locale, appDir = join(process.cwd(), 'app')): string[] {
  // A wrong working directory would make every page look untranslated, and the fallback would shadow real translations.
  if (!existsSync(join(appDir, locale))) throw new Error(`No ${locale} pages at ${join(appDir, locale)}; build the docs from apps/docs`);
  return Object.keys(ENGLISH_PAGES).filter((slug) => !isTranslated(locale, slug, appDir));
}

/** `untranslatedSlugs` for every non-default locale. Build time only, like `untranslatedSlugs`: it reads the file system and throws without the locale folders. */
export function untranslatedByLocale(appDir = join(process.cwd(), 'app')): Partial<Record<Locale, string[]>> {
  return Object.fromEntries(
    LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => [locale, untranslatedSlugs(locale, appDir)]),
  );
}
