import { Stack } from '@tounsoo/todae/stack';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES, localizedGroups } from '../lib/i18n/dictionaries';
import { HomeShowcase } from './HomeShowcase';
import { ArrowIcon } from './icons';
import { SiteButtonLink } from './SiteButtonLink';
import { SiteLink } from './SiteLink';

export function HomeContent({ locale }: { locale: Locale }) {
  const dict = DICTIONARIES[locale];
  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="hero-eyebrow">{dict.hero.eyebrow}</p>
          <h1 id="home-title">{dict.hero.title}</h1>
          <p className="hero-lead">{dict.hero.lead}</p>
          <Stack.Root className="hero-actions" direction="row" wrap>
            <SiteButtonLink href={localizePath('/guides/get-started', locale)} trailingIcon={<ArrowIcon />}>
              {dict.hero.start}
            </SiteButtonLink>
            <SiteButtonLink variant="secondary" href={localizePath('/playground', locale)}>
              {dict.hero.playground}
            </SiteButtonLink>
          </Stack.Root>
        </div>
        <div className="hero-showcase" role="group" aria-label={dict.hero.showcase}>
          <HomeShowcase locale={locale} />
        </div>
      </section>
      <div className="home-groups">
        {localizedGroups(locale).map((group) => (
          <section key={group.id} className="home-group" aria-labelledby={`home-${group.id}`}>
            <Stack.Root direction="row" justify="between" align="baseline">
              <h2 id={`home-${group.id}`}>{group.label}</h2>
              <span className="home-group-count">
                {group.links.length === 1
                  ? dict.groupCountOne
                  : dict.groupCount.replace('{count}', String(group.links.length))}
              </span>
            </Stack.Root>
            <p>{dict.groupBlurbs[group.id]}</p>
            <Stack.Root as="ul" direction="row" wrap gap="condensed">
              {group.links.map(([href, label]) => (
                <li key={href}>
                  <SiteLink href={href}>{label}</SiteLink>
                </li>
              ))}
            </Stack.Root>
          </section>
        ))}
      </div>
    </div>
  );
}
