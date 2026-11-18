import { DOCS_ORIGIN } from '../origin';
import { docsUrlFor, missingWhenNote, ownsPage, pageFor, parseWhen } from './mdx';
import { listComponentMeta, partsOf, resolveName, type ComponentMeta } from './meta';
import { envelope } from './budget';
import { allPages, type LocaleId } from './catalog';
import { readPage, whenLabels, type ReadOptions } from './read';
import { formatSuggestions, searchDocs } from './search';

const SOURCE = 'todae-docs' as const;

function partRecords(name: string) {
  return partsOf(name).map((part) => ({
    name: part.name,
    description: part.description,
    props: part.props,
    docsUrl: docsUrlFor(part.name),
  }));
}

function componentBody(component: ComponentMeta) {
  return {
    name: component.name,
    description: component.description,
    props: component.props,
    parts: partRecords(component.name),
    docsUrl: docsUrlFor(component.name),
    source: SOURCE,
  };
}

export function listComponents() {
  const components = listComponentMeta().map((component) => {
    const page = pageFor(component.name);
    const copy = page ? parseWhen(page.markdown, component.name) : null;
    const inherited = page != null && copy?.shared === true && !ownsPage(page, component.name);
    return {
      name: component.name,
      description: component.description,
      parts: partsOf(component.name).map((part) => part.name),
      docsUrl: docsUrlFor(component.name),
      hasWhenToUse: copy?.whenToUse != null && !inherited,
      ...(inherited ? { scope: 'page' as const } : {}),
    };
  });
  return envelope(
    { components, count: components.length, source: SOURCE },
    'component-list',
    [
      { tool: 'search_docs', arguments: { query: 'button' }, why: 'Find a component, prop or page without knowing its slug.' },
      { tool: 'get_component', arguments: { name: 'Button' }, why: 'Read one component. This list does not include props.' },
    ],
  );
}

export function getComponent(name: string) {
  let resolved;
  try {
    resolved = resolveName(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.startsWith('Unknown component')) throw error;
    throw new Error(`${message} ${formatSuggestions(searchDocs(name, { limit: 5 }))}`, { cause: error });
  }
  const body =
    resolved.kind === 'namespace'
      ? {
          name: resolved.name,
          namespace: true as const,
          description: null,
          props: [] as ComponentMeta['props'],
          parts: partRecords(resolved.name),
          docsUrl: docsUrlFor(resolved.name),
          source: SOURCE,
        }
      : componentBody(resolved.component);
  const canonical = resolved.kind === 'namespace' ? resolved.name : resolved.component.name;
  return envelope(body, resolved.kind === 'namespace' ? 'namespace' : 'component', [
    { tool: 'get_docs_page', arguments: { name: canonical }, why: 'The docs page. Example code is a stub until get_example.' },
    { tool: 'when_to_use', arguments: { name: canonical }, why: 'When to use it, as structured fields.' },
  ]);
}

export function whenToUse(name: string, options?: { locale?: LocaleId }) {
  const locale = options?.locale ?? 'en';
  const labels = whenLabels(locale);
  const resolved = resolveName(name);
  const canonical = resolved.kind === 'namespace' ? resolved.name : resolved.component.name;
  const english = pageFor(canonical);
  const localized = english ? allPages().find((item) => item.locale === locale && item.slug === english.slug) : undefined;
  // English reads the shared page cache, so a page that fails to parse reports missing without dropping the others.
  const page = locale === 'en' ? english : localized;
  if (!english || !page) {
    return envelope(
      {
        status: 'no-docs-page' as const,
        locale,
        whenToUse: null,
        whenNotToUse: null,
        docsUrl: null,
        source: SOURCE,
      },
      'when-to-use',
      [{ tool: 'search_docs', arguments: { query: name, ...(locale === 'ko' ? { locale } : {}) }, why: 'The name did not match a docs page.' }],
      { locale },
    );
  }
  const copy = parseWhen(page.markdown, canonical, labels);
  const scope = copy?.shared && !ownsPage(english, canonical) ? ('page' as const) : undefined;
  const docsUrl = 'docsUrl' in page && typeof page.docsUrl === 'string' ? page.docsUrl : `${DOCS_ORIGIN}/${page.slug}`;
  const next: { tool: string; arguments: Record<string, string>; why: string }[] = [
    { tool: 'get_docs_page', arguments: { name: `${page.slug}#${labels.heading}`, ...(locale === 'ko' ? { locale } : {}) }, why: 'The section this copy came from.' },
  ];
  if (!copy) {
    return envelope(
      {
        status: 'missing' as const,
        locale,
        whenToUse: null,
        whenNotToUse: null,
        docsUrl,
        note: locale === 'en' ? missingWhenNote(page.markdown, page.slug) : `No '${labels.heading}' section on /${locale}/${page.slug}. Not inferred.`,
        source: SOURCE,
      },
      'when-to-use',
      next,
      { locale, slug: page.slug },
    );
  }
  return envelope(
    {
      status: 'present' as const,
      locale,
      whenToUse: copy.whenToUse,
      whenNotToUse: copy.whenNotToUse,
      docsUrl,
      section: labels.heading,
      ...(scope ? { scope } : {}),
      source: SOURCE,
    },
    'when-to-use',
    next,
    { locale, slug: page.slug, section: labels.heading },
  );
}

/**
 * A docs page by slug, docs URL, or component name. A `#anchor` or `section` reads that section.
 * `ko/…` or `locale: "ko"` reads the Korean page. Example source is a stub unless `includeCode` is set.
 * A stubbed page over the large-page threshold returns an outline and the intro.
 */
export function getDocsPage(query: string, options?: ReadOptions) {
  return readPage(query, options);
}
