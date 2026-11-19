import { DOCS_ORIGIN } from '../origin';
import { docsUrlFor, EN_WHEN, missingWhenNote, ownsPage, pageFor, parseWhen } from './mdx';
import { listComponentMeta, partsOf, resolveName, type ComponentMeta } from './meta';
import { envelope, fitSlice, type NextCall } from './budget';
import { readPage, type ReadOptions } from './read';
import { formatSuggestions, searchDocs } from './search';
import { closeNames } from './units';

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

function componentRows() {
  return listComponentMeta().map((component) => {
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
}

const COMPONENT_NEXT: NextCall[] = [
  { tool: 'search_docs', arguments: { query: 'button' }, why: 'Find a component, prop or page without knowing its slug.' },
  { tool: 'get_component', arguments: { name: 'Button' }, why: 'Read one component. This list does not include props.' },
];

export function listComponents(options?: { offset?: number }) {
  const components = componentRows();
  if (options?.offset === undefined) {
    return envelope({ components, count: components.length, source: SOURCE }, 'component-list', COMPONENT_NEXT);
  }
  const start = options.offset;
  return fitSlice(components, start, (slice, cursor) =>
    envelope(
      { components: slice, count: components.length, offset: start, ...(cursor ? { cursor } : {}), source: SOURCE },
      'component-list',
      cursor
        ? [{ tool: 'list_components', arguments: { offset: cursor.offset }, why: 'The next components in this list.' }, ...COMPONENT_NEXT]
        : COMPONENT_NEXT,
    ),
  );
}

function unknownComponent(name: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unknown component';
  const near = closeNames(name, listComponentMeta().map((item) => item.name));
  const hits = searchDocs(name, { limit: 5 });
  const lines = [
    ...near.map((item) => `- ${item}`),
    ...hits
      .filter((hit) => !near.includes(hit.component ?? hit.title))
      .slice(0, 5)
      .map((hit) => `- ${hit.ref} (${hit.kind}, ${hit.locale}, ${hit.tokens} tokens): ${hit.title}`),
  ];
  const hint = lines.length > 0 ? `Did you mean:\n${lines.join('\n')}\nCall search_docs.` : formatSuggestions(hits);
  return new Error(`${message} ${hint}`, { cause: error });
}

export function getComponent(name: string) {
  let resolved;
  try {
    resolved = resolveName(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.startsWith('Unknown component')) throw error;
    throw unknownComponent(name, error);
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

export function whenToUse(name: string) {
  let resolved;
  try {
    resolved = resolveName(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.startsWith('Unknown component')) throw error;
    throw unknownComponent(name, error);
  }
  const canonical = resolved.kind === 'namespace' ? resolved.name : resolved.component.name;
  const page = pageFor(canonical);
  if (!page) {
    return envelope(
      {
        status: 'no-docs-page' as const,
        locale: 'en' as const,
        whenToUse: null,
        whenNotToUse: null,
        docsUrl: null,
        source: SOURCE,
      },
      'when-to-use',
      [{ tool: 'search_docs', arguments: { query: name }, why: 'The name did not match a docs page.' }],
      { locale: 'en' },
    );
  }
  const copy = parseWhen(page.markdown, canonical);
  const scope = copy?.shared && !ownsPage(page, canonical) ? ('page' as const) : undefined;
  const docsUrl = `${DOCS_ORIGIN}/${page.slug}`;
  const next: { tool: string; arguments: Record<string, string>; why: string }[] = [
    { tool: 'get_docs_page', arguments: { name: `${page.slug}#${EN_WHEN.heading}` }, why: 'The section this copy came from.' },
  ];
  if (!copy) {
    return envelope(
      {
        status: 'missing' as const,
        locale: 'en' as const,
        whenToUse: null,
        whenNotToUse: null,
        docsUrl,
        note: missingWhenNote(page.markdown, page.slug),
        source: SOURCE,
      },
      'when-to-use',
      next,
      { locale: 'en', slug: page.slug },
    );
  }
  return envelope(
    {
      status: 'present' as const,
      locale: 'en' as const,
      whenToUse: copy.whenToUse,
      whenNotToUse: copy.whenNotToUse,
      docsUrl,
      section: EN_WHEN.heading,
      ...(scope ? { scope } : {}),
      source: SOURCE,
    },
    'when-to-use',
    next,
    { locale: 'en', slug: page.slug, section: EN_WHEN.heading },
  );
}

/**
 * A docs page by slug, docs URL, or component name. A `#anchor` or `section` reads that section.
 * A `ko/` prefix reads the English page at the rest of the path. Example source is a stub unless `includeCode` is set.
 * A stubbed page over the large-page threshold returns an outline and the intro.
 */
export function getDocsPage(query: string, options?: ReadOptions) {
  return readPage(query, options);
}
