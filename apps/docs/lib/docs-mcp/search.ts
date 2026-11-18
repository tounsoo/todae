import { envelope, type NextCall } from './budget';
import { allPages, type ExampleFile, type LocaleId, type PageRecord, type SectionRecord } from './catalog';
import { listComponentMeta } from './meta';
import { catalogTokens } from './tokens';
import { normalizeSlug, snippet, splitIdent, tokenize, tokensOf } from './units';

export type HitKind = 'page' | 'section' | 'component' | 'prop' | 'hook' | 'recipe' | 'example' | 'token';

export type SearchHit = {
  title: string;
  kind: HitKind;
  /** `slug`, or `slug#anchor` for a section. A token's ref is `tokens` and `path` is the catalog path. */
  ref: string;
  locale: LocaleId;
  snippet: string;
  /** chars/4 of the call that reads this hit, an upper bound the agent can budget. */
  tokens: number;
  path?: string;
  component?: string;
};

type Doc = SearchHit & { titleTerms: string[]; bodyTerms: string[]; length: number };

function cost(chars: number): number {
  return tokensOf(chars + 800);
}

function sectionRef(page: PageRecord, section: SectionRecord): string {
  return `${page.slug}#${section.anchor}`;
}

function exampleHit(page: PageRecord, file: ExampleFile): Doc {
  const title = file.file;
  const body = `${file.demonstrates} ${file.id} ${page.title}`;
  return {
    title,
    kind: 'example',
    ref: file.anchor ? `${page.slug}#${file.anchor}` : page.slug,
    locale: page.locale,
    snippet: snippet(`${file.demonstrates}. ${file.lines} lines.`),
    tokens: Math.min(cost(file.text.length), 9_000),
    titleTerms: tokenize(title),
    bodyTerms: tokenize(body),
    length: 0,
  };
}

function docsOf(pages: readonly PageRecord[]): Doc[] {
  const docs: Doc[] = [];
  for (const page of pages) {
    const kind: HitKind = page.slug.startsWith('recipes/') && !page.slug.slice('recipes/'.length).includes('/') ? 'recipe' : 'page';
    docs.push({
      title: page.title,
      kind,
      ref: page.slug,
      locale: page.locale,
      snippet: snippet(page.description || page.intro),
      tokens: Math.min(cost(page.markdown.length), 4_200),
      titleTerms: tokenize(`${page.title} ${page.slug}`),
      bodyTerms: tokenize(page.intro),
      length: 0,
    });
    for (const section of page.sections) {
      docs.push({
        title: section.heading,
        kind: 'section',
        ref: sectionRef(page, section),
        locale: page.locale,
        snippet: snippet(section.markdown),
        tokens: cost(section.markdown.length),
        titleTerms: tokenize(`${section.heading} ${page.title}`),
        bodyTerms: tokenize(section.markdown),
        length: 0,
      });
    }
    const seen = new Set<string>();
    for (const file of page.examples) {
      if (seen.has(file.file)) continue;
      seen.add(file.file);
      docs.push(exampleHit(page, file));
    }
  }
  return docs;
}

function apiDocs(): Doc[] {
  const docs: Doc[] = [];
  for (const component of listComponentMeta()) {
    const kind: HitKind = component.name.startsWith('use') ? 'hook' : 'component';
    const page = allPages().find((item) => item.locale === 'en' && (item.props.includes(component.name) || item.title === component.name || item.slug === component.name.toLowerCase()));
    const ref = page?.slug ?? component.name;
    docs.push({
      title: component.name,
      kind,
      ref,
      locale: 'en',
      snippet: snippet(component.description),
      tokens: cost(JSON.stringify(component).length),
      component: component.name,
      titleTerms: tokenize(component.name),
      bodyTerms: tokenize(component.description),
      length: 0,
    });
    for (const prop of component.props) {
      docs.push({
        title: `${component.name} ${prop.name}`,
        kind: 'prop',
        ref: page ? `${page.slug}#props` : ref,
        locale: 'en',
        snippet: snippet(prop.description),
        tokens: cost(JSON.stringify(component).length),
        component: component.name,
        path: prop.name,
        titleTerms: tokenize(`${component.name} ${prop.name}`),
        bodyTerms: tokenize(`${prop.name} ${prop.type} ${prop.description}`),
        length: 0,
      });
    }
  }
  const seen = new Set<string>();
  for (const token of catalogTokens()) {
    if (seen.has(token.path)) continue;
    seen.add(token.path);
    docs.push({
      title: token.path,
      kind: 'token',
      ref: 'tokens#catalog',
      locale: 'en',
      snippet: snippet(token.description ?? `${token.path} (${token.layer})`),
      tokens: 400,
      path: token.path,
      titleTerms: tokenize(token.path),
      bodyTerms: tokenize(`${token.path} ${token.description ?? ''} ${token.cssVar} ${token.layer}`),
      length: 0,
    });
  }
  return docs;
}

let index: { docs: Doc[]; avg: number; titleDf: Map<string, number>; bodyDf: Map<string, number> } | null = null;

function buildIndex() {
  const docs = [...docsOf(allPages()), ...apiDocs()];
  for (const doc of docs) doc.length = doc.titleTerms.length + doc.bodyTerms.length;
  const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length);
  const titleDf = new Map<string, number>();
  const bodyDf = new Map<string, number>();
  const count = (terms: string[], df: Map<string, number>) => {
    for (const term of new Set(terms)) df.set(term, (df.get(term) ?? 0) + 1);
  };
  for (const doc of docs) {
    count(doc.titleTerms, titleDf);
    count(doc.bodyTerms, bodyDf);
  }
  return { docs, avg, titleDf, bodyDf };
}

function ready() {
  index ??= buildIndex();
  return index;
}

function bm25(tf: number, df: number, docLen: number, avg: number, n: number): number {
  if (tf === 0 || df === 0) return 0;
  const k1 = 1.2;
  const b = 0.75;
  const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
  return idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * docLen) / avg)));
}

function wordHits(word: string, keys: string[]): boolean {
  return keys.some((key) => {
    if (word === key && key.length > 1) return true;
    return key.length > 3 && word.startsWith(key) && word.length - key.length > 0 && word.length - key.length <= 4;
  });
}

function headingLeads(title: string, keys: string[]): boolean {
  const words = normalizeSlug(title).split('-').filter((word) => word.length > 1);
  // A two-letter English word is not the lead, so "form" does not steal a heading from ErrorMessage.
  const lead = words.find((word) => word.length > 2);
  return lead != null && wordHits(lead, keys);
}

function tfOf(terms: string[], key: string): number {
  let count = 0;
  for (const term of terms) if (term === key) count += 1;
  return count;
}

const KIND_WORD: Partial<Record<HitKind, string>> = {
  prop: 'prop',
  hook: 'hook',
  token: 'token',
  recipe: 'recipe',
  example: 'example',
};

/** Ranked hits for a natural-language query. The index is the English docs. */
export function searchDocs(query: string, options?: { limit?: number }): SearchHit[] {
  const limit = Math.min(20, Math.max(1, options?.limit ?? 8));
  const keys = [...new Set(tokenize(query))];
  if (keys.length === 0) return [];
  const { docs, avg, titleDf, bodyDf } = ready();
  const folded = query.trim().toLowerCase();
  const norm = normalizeSlug(query);
  const wants = new Set(keys);
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const doc of docs) {
    let score = 0;
    for (const key of keys) {
      score += bm25(tfOf(doc.bodyTerms, key), bodyDf.get(key) ?? 0, doc.length, avg, docs.length);
      score += 2.2 * bm25(tfOf(doc.titleTerms, key), titleDf.get(key) ?? 0, doc.length, avg, docs.length);
    }
    if (score === 0) continue;
    const titleKeys = new Set(doc.titleTerms);
    if (keys.every((key) => titleKeys.has(key))) score += 3;
    if (doc.title.toLowerCase() === folded || normalizeSlug(doc.title) === norm) score += 8;
    if (doc.ref === norm || doc.path === folded || doc.component?.toLowerCase() === folded) score += 8;
    const kindWord = KIND_WORD[doc.kind];
    if (kindWord && wants.has(kindWord)) score += 2;
    if (doc.kind === 'recipe' && wants.has('recipe')) score += 1;
    // A heading that is the query's word ("Dragging") should beat a longer heading that only contains it.
    if (doc.kind === 'section' && headingLeads(doc.title, keys)) score += 8;
    const pageSlug = doc.ref.split('#')[0] ?? doc.ref;
    // The server manual mentions every tool, so it should not win a question about the product.
    if (pageSlug === 'mcp' && !wants.has('mcp')) score -= 8;
    const slugWords = pageSlug.split(/[/-]/);
    if (slugWords.some((word) => word.length > 3 && wants.has(word))) score += 6;
    // A name that is a query word ("Calendar") beats a prop that only shares a short word ("pick").
    if ((doc.kind === 'prop' || doc.kind === 'component' || doc.kind === 'hook') && doc.component) {
      const nameWords = splitIdent(doc.component).toLowerCase().split(/[^\p{L}\p{N}]+/u);
      if (nameWords.some((word) => word.length > 4 && wants.has(word))) score += 2;
    }
    // A heading that is only "Props" is the props table. A question that did not ask for props should not land under it.
    if (doc.kind === 'section' && normalizeSlug(doc.title) === 'props' && !wants.has('prop')) score -= 2;
    // A how-to asks for the page. An example wins when the query asks for one.
    if (doc.kind === 'example' && !wants.has('example')) score -= 2;
    scored.push({
      score,
      hit: {
        title: doc.title,
        kind: doc.kind,
        ref: doc.ref,
        locale: doc.locale,
        snippet: doc.snippet,
        tokens: doc.tokens,
        ...(doc.path ? { path: doc.path } : {}),
        ...(doc.component ? { component: doc.component } : {}),
      },
    });
  }
  scored.sort((a, b) => b.score - a.score || a.hit.ref.localeCompare(b.hit.ref));
  const seen = new Set<string>();
  const propSeen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const row of scored) {
    const id = `${row.hit.kind}:${row.hit.locale}:${row.hit.ref}:${row.hit.title}`;
    if (seen.has(id)) continue;
    // One prop per component, unless the query asked for props, so a how-to is not buried under three props.
    if (row.hit.kind === 'prop' && !wants.has('prop') && row.hit.component) {
      if (propSeen.has(row.hit.component)) continue;
      propSeen.add(row.hit.component);
    }
    seen.add(id);
    hits.push(row.hit);
    if (hits.length >= limit) break;
  }
  return hits;
}

function nextFor(hit: SearchHit | undefined): NextCall[] {
  if (!hit) return [{ tool: 'list_components', arguments: {}, why: 'No hit. List components, or try a shorter query.' }];
  if (hit.kind === 'token' && hit.path) {
    return [{ tool: 'get_token', arguments: { path: hit.path }, why: `Token ${hit.path}, about ${hit.tokens} tokens.` }];
  }
  if ((hit.kind === 'prop' || hit.kind === 'component' || hit.kind === 'hook') && hit.component) {
    return [{ tool: 'get_component', arguments: { name: hit.component }, why: `${hit.component} props, about ${hit.tokens} tokens.` }];
  }
  if (hit.kind === 'example') {
    const page = hit.ref.split('#')[0] ?? hit.ref;
    return [{
      tool: 'get_example',
      arguments: { page, file: hit.title },
      why: `${hit.title} on ${page}, about ${hit.tokens} tokens.`,
    }];
  }
  return [{
    tool: 'get_docs_page',
    arguments: { name: hit.ref },
    why: `${hit.title} (${hit.kind}), about ${hit.tokens} tokens.`,
  }];
}

/** The search_docs payload: hits plus the one call an agent should make next. */
export function presentSearch(query: string, options?: { limit?: number }) {
  const hits = searchDocs(query, options);
  return envelope({ kind: 'search' as const, query, hits }, 'search', nextFor(hits[0]));
}

export function formatSuggestions(hits: SearchHit[]): string {
  if (hits.length === 0) return 'Call search_docs.';
  const lines = hits.slice(0, 5).map((hit) => `- ${hit.ref} (${hit.kind}, ${hit.locale}, ${hit.tokens} tokens): ${hit.title}`);
  return `Did you mean:\n${lines.join('\n')}\nCall search_docs.`;
}
