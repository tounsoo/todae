import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';

export function HomeContent({ locale }: { locale: Locale }) {
  return (
    <>
      <h1>Todae</h1>
      <p>{DICTIONARIES[locale].tagline}</p>
      {localizedGroups(locale).map((group) => (
        <section key={group.id} aria-labelledby={`home-${group.id}`}>
          <h2 id={`home-${group.id}`}>{group.label}</h2>
          <ul>
            {group.links.map(([href, label]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
