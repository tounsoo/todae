import type { Metadata } from 'next';
import { DOCS_ORIGIN } from '../origin';
import { localizePath, type Locale } from './config';
import { DICTIONARIES } from './dictionaries';

export const SITE_NAME = 'Todae';

/** The size of every social image, the one link previews expect for a large card. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Open Graph wants a territory with the language. */
const OG_LOCALES: Record<Locale, string> = { en: 'en_US', ko: 'ko_KR' };

/** Where the social image for a page lives. `slug` is empty for the home page. */
export function ogImagePath(locale: Locale, slug: string): string {
  return `/og/${locale}${slug ? `/${slug}` : ''}`;
}

type Social = { locale: Locale; slug: string; title: string; description: string };

/** A page's path in its own language, the canonical URL relative to `metadataBase`. */
export function pagePath(locale: Locale, slug: string): string {
  return localizePath(slug ? `/${slug}` : '/', locale);
}

/** Open Graph and Twitter tags for one page. Next replaces, not merges, a parent's `openGraph`, so each page sends all of it. */
function social({ locale, slug, title, description }: Social, url?: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  const image = { url: ogImagePath(locale, slug), ...OG_IMAGE_SIZE, alt: title };
  return {
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: OG_LOCALES[locale],
      ...(url && { url }),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** Metadata every page in `locale` shares. Each locale's root layout exports it, and pages without their own fall back to it. */
export function localeMetadata(locale: Locale): Metadata {
  const description = DICTIONARIES[locale].hero.lead;
  const { openGraph, twitter } = social({ locale, slug: '', title: SITE_NAME, description });
  // No url or canonical here: this also covers the 404 page, which is no page's canonical.
  return {
    metadataBase: new URL(DOCS_ORIGIN),
    title: SITE_NAME,
    description,
    openGraph,
    twitter,
    icons: { icon: { url: '/brand/icon.svg', type: 'image/svg+xml' }, apple: '/brand/apple-icon.png' },
  };
}

/**
 * One page's metadata: its title, description, canonical URL and link preview.
 * MDX pages get this from `remarkPageMetadata`, with the title and first
 * paragraph of the page; other pages call it themselves. `slug` is the path
 * without the locale prefix or leading slash, empty for the home page.
 */
export function pageMetadata({ locale, slug, title, description }: Social): Metadata {
  const fullTitle = slug ? `${title} · ${SITE_NAME}` : title;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: pagePath(locale, slug) },
    ...social({ locale, slug, title: fullTitle, description }, pagePath(locale, slug)),
  };
}
