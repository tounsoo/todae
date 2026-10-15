import { Link } from '@tounsoo/todae/link';
import { DocsProse } from '../components/DocsProse';
import { SiteShell } from '../components/SiteShell';
import { LOCALES, localizePath } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { localeMetadata } from '../lib/i18n/metadata';

export const metadata = localeMetadata('en');

// Each locale has its own root layout, so a URL that matches none of them renders this.
// It is static and cannot tell which language the reader wanted, so it speaks all of them.
// Its home links lead out of this root layout, which Next loads in full, so they skip next/link.
export default function GlobalNotFound() {
  return (
    <SiteShell locale="en" notFound>
      <DocsProse>
        <h1>404</h1>
        {LOCALES.map((locale) => (
          <p key={locale} lang={locale}>
            {DICTIONARIES[locale].notFound} <Link.Root href={localizePath('/', locale)}>{DICTIONARIES[locale].home}</Link.Root>
          </p>
        ))}
      </DocsProse>
    </SiteShell>
  );
}
