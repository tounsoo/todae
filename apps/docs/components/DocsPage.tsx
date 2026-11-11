import { Disclosure } from '@tounsoo/todae/disclosure';
import type { ReactNode } from 'react';
import type { Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { DocsProse } from './DocsProse';
import { PageContents, type PageSection } from './PageContents';
import { PageContentsAside } from './PageContentsAside';

/**
 * Every MDX page, as `remarkPageContents` wraps it: the content in Prose.Root and, on wide screens, the
 * page's sections in a column beside it. `contents` is the sections as JSON, empty when there are fewer than two.
 */
export function DocsPage({ locale, contents, children }: { locale: Locale; contents: string; children?: ReactNode }) {
  const sections = JSON.parse(contents) as PageSection[];
  if (sections.length === 0) return <DocsProse>{children}</DocsProse>;
  return (
    <div className="docs-page">
      <DocsProse>{children}</DocsProse>
      <PageContentsAside sections={sections} label={DICTIONARIES[locale].onThisPage} />
    </div>
  );
}

/** The page's sections folded under the lede, for screens too narrow for the column beside the page. */
export function PageContentsFold({ locale, contents }: { locale: Locale; contents: string }) {
  const label = DICTIONARIES[locale].onThisPage;
  return (
    <Disclosure.Root className="docs-contents-fold">
      <Disclosure.Summary>{label}</Disclosure.Summary>
      <PageContents sections={JSON.parse(contents) as PageSection[]} ariaLabel={label} />
    </Disclosure.Root>
  );
}
