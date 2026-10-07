import type { Metadata } from 'next';
import { DOCS_ORIGIN } from '../origin';
import type { Locale } from './config';
import { DICTIONARIES } from './dictionaries';

/** Metadata every page in `locale` shares. Each locale's root layout exports it. */
export function localeMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(DOCS_ORIGIN),
    title: 'Todae',
    description: DICTIONARIES[locale].siteDescription,
  };
}
