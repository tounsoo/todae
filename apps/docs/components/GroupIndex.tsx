import type { ReactNode } from 'react';
import { stripLocale, type Locale } from '../lib/i18n/config';
import { catalog } from '../lib/i18n/dictionaries';
import { pageMetadata } from '../lib/i18n/metadata';
import { pageDescriptions } from '../lib/pageDescriptions';
import type { IndexGroupId } from './siteGroups';
import { DocsProse } from './DocsProse';
import { SiteLink } from './SiteLink';

function slugOf(href: string): string {
  return stripLocale(href).slice(1);
}

function Item({
  href,
  label,
  description,
  children,
}: {
  href: string;
  label: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <li>
      <SiteLink href={href}>{label}</SiteLink>
      {description ? <p>{description}</p> : null}
      {children}
    </li>
  );
}

export function groupIndexMetadata(locale: Locale, id: IndexGroupId) {
  const page = catalog(locale, id);
  return pageMetadata({ locale, slug: id, title: page.title, description: page.description });
}

export function GroupIndex({
  locale,
  id,
  descriptions,
}: {
  locale: Locale;
  id: IndexGroupId;
  descriptions: ReadonlyMap<string, string>;
}) {
  const page = catalog(locale, id);
  return (
    <DocsProse>
      <h1>{page.title}</h1>
      <p>{page.description}</p>
      <ul className="group-index">
        {page.links.map(([href, label, children]) => (
          <Item key={href} href={href} label={label} description={descriptions.get(slugOf(href))}>
            {children.length > 0 ? (
              <ul>
                {children.map(([childHref, childLabel]) => (
                  <Item
                    key={childHref}
                    href={childHref}
                    label={childLabel}
                    description={descriptions.get(slugOf(childHref))}
                  />
                ))}
              </ul>
            ) : null}
          </Item>
        ))}
      </ul>
    </DocsProse>
  );
}

export function GroupIndexPage({ locale, id }: { locale: Locale; id: IndexGroupId }) {
  return <GroupIndex locale={locale} id={id} descriptions={pageDescriptions(locale)} />;
}
