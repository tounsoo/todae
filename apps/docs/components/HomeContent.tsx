import { DEFAULT_LOCALE, localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';
import { HomeShowcase } from './HomeShowcase';
import { ArrowIcon } from './icons';

export function HomeContent({ locale }: { locale: Locale }) {
  const dict = DICTIONARIES[locale];
  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="hero-eyebrow">{dict.hero.eyebrow}</p>
          <h1 id="home-title">{dict.hero.title}</h1>
          <p className="hero-lead">{dict.hero.lead}</p>
          <div className="hero-actions">
            <a className="docs-cta docs-cta-primary" href={localizePath('/guides/build-on-todae', locale)}>
              {dict.hero.start}
              <ArrowIcon />
            </a>
            <a className="docs-cta" href={localizePath('/playground', locale)}>
              {dict.hero.playground}
            </a>
          </div>
        </div>
        <div className="hero-showcase" role="group" aria-label={dict.hero.showcase}>
          {/* Demo copy is written in English. */}
          <div lang={locale === DEFAULT_LOCALE ? undefined : DEFAULT_LOCALE}>
            <HomeShowcase />
          </div>
        </div>
      </section>
      <div className="home-groups">
        {localizedGroups(locale).map((group) => (
          <section key={group.id} className="home-group" aria-labelledby={`home-${group.id}`}>
            <div className="home-group-head">
              <h2 id={`home-${group.id}`}>{group.label}</h2>
              <span className="home-group-count">
                {group.links.length === 1
                  ? dict.groupCountOne
                  : dict.groupCount.replace('{count}', String(group.links.length))}
              </span>
            </div>
            <p>{dict.groupBlurbs[group.id]}</p>
            <ul>
              {group.links.map(([href, label]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
