import { DEFAULT_LOCALE, type Locale } from './config';
import ko from './props/ko.json';

/** Component → prop → the English it was translated from, and the translation. */
export type PropTranslations = Record<string, Record<string, Partial<Record<Locale, string>>>>;

/** Prop descriptions come from the design system's JSDoc in English; these translate them. */
export const PROP_TRANSLATIONS: Partial<Record<Locale, PropTranslations>> = { ko };

/**
 * A prop's description in `locale`, and the language it is in. A missing translation,
 * or one made from older English, shows the current English instead.
 */
export function propDescription(locale: Locale, component: string, prop: string, english: string): { text: string; lang: Locale } {
  const entry = PROP_TRANSLATIONS[locale]?.[component]?.[prop];
  const text = entry?.[locale];
  return locale !== DEFAULT_LOCALE && text && entry[DEFAULT_LOCALE] === english
    ? { text, lang: locale }
    : { text: english, lang: DEFAULT_LOCALE };
}
