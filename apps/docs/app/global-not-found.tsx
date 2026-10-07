import { SiteShell } from '../components/SiteShell';
import { LOCALES, localizePath } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { localeMetadata } from '../lib/i18n/metadata';

export const metadata = localeMetadata('en');

// Each locale has its own root layout, so a URL that matches none of them renders this.
// It is static and cannot tell which language the reader wanted, so it speaks all of them.
export default function GlobalNotFound() {
  return (
    <SiteShell locale="en">
      <h1>404</h1>
      {LOCALES.map((locale) => (
        <p key={locale} lang={locale}>
          {DICTIONARIES[locale].notFound} <a href={localizePath('/', locale)}>{DICTIONARIES[locale].home}</a>
        </p>
      ))}
    </SiteShell>
  );
}
