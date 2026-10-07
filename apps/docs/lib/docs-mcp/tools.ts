import { DOCS_ORIGIN } from '../origin';
import { docsUrlFor, missingWhenNote, ownsPage, pageFor, parseWhen } from './mdx';
import { listComponentMeta, partsOf, resolveName, type ComponentMeta } from './meta';

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
  return { components, count: components.length, source: SOURCE };
}

export function getComponent(name: string) {
  const resolved = resolveName(name);
  if (resolved.kind === 'namespace') {
    return {
      name: resolved.name,
      namespace: true as const,
      description: null,
      props: [] as ComponentMeta['props'],
      parts: partRecords(resolved.name),
      docsUrl: docsUrlFor(resolved.name),
      source: SOURCE,
    };
  }
  return componentBody(resolved.component);
}

export function whenToUse(name: string) {
  const resolved = resolveName(name);
  const canonical = resolved.kind === 'namespace' ? resolved.name : resolved.component.name;
  const page = pageFor(canonical);
  if (!page) {
    return {
      status: 'no-docs-page' as const,
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: null,
      source: SOURCE,
    };
  }
  const copy = parseWhen(page.markdown, canonical);
  const scope = copy?.shared && !ownsPage(page, canonical) ? ('page' as const) : undefined;
  if (!copy) {
    return {
      status: 'missing' as const,
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
      note: missingWhenNote(page.markdown, page.slug),
      source: SOURCE,
    };
  }
  return {
    status: 'present' as const,
    whenToUse: copy.whenToUse,
    whenNotToUse: copy.whenNotToUse,
    docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
    section: 'When to use',
    ...(scope ? { scope } : {}),
    source: SOURCE,
  };
}
