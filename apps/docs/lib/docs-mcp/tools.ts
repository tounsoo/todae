import { DOCS_ORIGIN, docsUrlFor, pageFor } from './mdx';
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
    return {
      name: component.name,
      description: component.description,
      parts: partsOf(component.name).map((part) => part.name),
      docsUrl: docsUrlFor(component.name),
      hasWhenToUse: page?.whenToUse != null,
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
  const scope = page && page.title !== canonical ? ('page' as const) : undefined;
  if (!page) {
    return {
      status: 'no-docs-page' as const,
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: null,
      source: SOURCE,
    };
  }
  if (page.whenToUse == null) {
    return {
      status: 'missing' as const,
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
      note: `No 'When to use' section on /${page.slug}. Not inferred.`,
      ...(scope ? { scope } : {}),
      source: SOURCE,
    };
  }
  return {
    status: 'present' as const,
    whenToUse: page.whenToUse,
    whenNotToUse: page.whenNotToUse,
    docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
    section: 'When to use',
    ...(scope ? { scope } : {}),
    source: SOURCE,
  };
}
