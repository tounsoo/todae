/** Docs languages. English is the default and has no URL prefix; every other locale lives under `/<locale>`. */
export const LOCALES = ['en', 'ko'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Locales that keep every page translated. A test fails when one of them lacks a page; a new
 * locale can fall back to English page by page and joins this list once it has them all.
 */
export const COMPLETE_LOCALES: readonly Locale[] = ['ko'];

/** Each language's name in that language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** The prefixed locale of a path, such as `ko` for `/ko/button`. Unprefixed paths are English. */
export function localeOf(path: string): Locale {
  const first = path.split(/[/?#]/)[1] ?? '';
  return isLocale(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
}

/** The path without its locale prefix: `/ko/button` is `/button`, and `/ko` is `/`. */
export function stripLocale(path: string): string {
  const locale = localeOf(path);
  if (locale === DEFAULT_LOCALE) return path;
  const rest = path.slice(locale.length + 1);
  return rest === '' || /^[?#]/.test(rest) ? `/${rest}` : rest;
}

/**
 * The same page in another locale. Only same-site absolute paths change;
 * external links, protocol-relative URLs, hashes, the API, Next's assets and
 * files such as `/favicon.ico` keep theirs.
 */
export function localizePath(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//') || /^\/(api|_next)(\/|$)/.test(href)) return href;
  if (/\.(css|gif|ico|jpe?g|js|json|pdf|png|svg|txt|webmanifest|webp|woff2?|xml)$/i.test(href.split(/[?#]/)[0] ?? '')) return href;
  const path = stripLocale(href);
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' || /^\/[?#]/.test(path) ? `/${locale}${path.slice(1)}` : `/${locale}${path}`;
}
