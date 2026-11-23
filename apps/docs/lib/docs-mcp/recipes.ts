import { envelope, seal } from './budget';
import { allPages, type PageRecord } from './catalog';
import { parseWhen } from './mdx';
import { listComponentMeta } from './meta';
import { readPage, type ReadOptions } from './read';
import { formatSuggestions, searchDocs } from './search';
import { normalizeSlug, SOURCE } from './units';

const PREFIX = 'recipes/';

const NAMES = new Set(listComponentMeta().map((row) => row.name));

function recipePages(): PageRecord[] {
  return allPages()
    .filter((page) => page.locale === 'en' && page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Todae exports named in `code`, such as `Disclosure.Root` and `useInlineEdit`. Names have at most one dot; a fence's language tag is never one. */
export function exportsIn(code: string): string[] {
  const tokens = new Set(code.match(/(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) ?? []);
  return [...tokens].filter((token) => NAMES.has(token)).sort();
}

export function listRecipes() {
  const rows = recipePages().map((page) => {
    const name = page.slug.slice(PREFIX.length);
    const whenToUse = parseWhen(page.markdown, page.title)?.whenToUse ?? null;
    return {
      name,
      title: page.title,
      // The intro paragraph, as the page's link preview reads it, not cut short.
      description: page.description,
      uses: exportsIn(page.code),
      docsUrl: page.docsUrl,
      hasWhenToUse: whenToUse != null,
    };
  });
  return envelope({ recipes: rows, count: rows.length, source: SOURCE }, 'recipe-list', [
    { tool: 'search_docs', arguments: { query: 'scheduler recipe' }, why: 'Find a recipe from the task instead of this list.' },
    { tool: 'get_recipe', arguments: { name: 'data-table' }, why: 'Read one recipe. Example code is a stub until get_example.' },
  ]);
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string, options?: ReadOptions) {
  const folded = query.trim().toLowerCase();
  const norm = normalizeSlug(query.replace(/^recipes\//, ''));
  const page = recipePages().find((item) => {
    const name = item.slug.slice(PREFIX.length);
    return name === folded || name === norm || item.title.toLowerCase() === folded;
  });
  if (!page) throw new Error(`Unknown recipe "${query}". Call list_recipes. ${formatSuggestions(searchDocs(query, { limit: 5 }))}`);
  const copy = parseWhen(page.markdown, page.title);
  const read = readPage(page.slug, options);
  return seal({
    ...read,
    name: page.slug.slice(PREFIX.length),
    whenToUse: copy?.whenToUse ?? null,
    whenNotToUse: copy?.whenNotToUse ?? null,
  });
}
