import { join } from 'node:path';
import { loadPages } from '../docs-mcp/mdx';
import { LOCALES, type Locale } from '../i18n/config';
import { DICTIONARIES, localizedGroups } from '../i18n/dictionaries';

export type OgPage = {
  locale: Locale;
  /** Path without the locale prefix or leading slash; empty for the home page. */
  slug: string;
  /** The small label above the title: the page's sidebar section. */
  eyebrow: string;
  title: string;
};

const LOCALE_DIRS: Record<Locale, string> = { en: '(en)', ko: 'ko' };

/** The sidebar section a page sits in, in `locale`. */
function sectionOf(locale: Locale, slug: string): string {
  const english = `/${slug}`;
  const group = localizedGroups('en').findIndex((item) => item.links.some(([href, , children]) => href === english || children.some(([child]) => child === english)));
  return group < 0 ? '' : (localizedGroups(locale)[group]?.label ?? '');
}

/**
 * Every page with a social image of its own, in every language that has the
 * page. A Korean URL that shows the English page previews with the English image.
 * Build time only: it reads the page files.
 */
export function ogPages(appDir = join(process.cwd(), 'app')): OgPage[] {
  return LOCALES.flatMap((locale) => {
    const dict = DICTIONARIES[locale];
    const home: OgPage = { locale, slug: '', eyebrow: dict.hero.eyebrow, title: dict.hero.title };
    const playground: OgPage = { locale, slug: 'playground', eyebrow: sectionOf(locale, 'playground'), title: dict.playground.title };
    const mdx = loadPages(join(appDir, LOCALE_DIRS[locale])).map((page) => ({
      locale,
      slug: page.slug,
      eyebrow: sectionOf(locale, page.slug),
      title: page.title,
    }));
    return [home, playground, ...mdx];
  });
}
