import type { Code, Node, Paragraph } from 'mdast';
import { DOCS_ORIGIN } from '../origin';
import { parse } from '../i18n/sections';
import { absolutize, listPages, parseWhen } from './mdx';
import { listComponentMeta } from './meta';

const SOURCE = 'todae-docs' as const;
const PREFIX = 'recipes/';
const NAMES = new Set(listComponentMeta().map((row) => row.name));

/** The intro's first paragraph: the first one after the title and before the first `##`, as Markdown on one line. */
export function summaryOf(markdown: string): string | null {
  let titled = false;
  for (const node of parse(markdown).children) {
    if (node.type === 'heading') {
      if (titled) return null;
      titled = node.depth === 1;
    } else if (titled && node.type === 'paragraph') {
      const { start, end } = (node as Paragraph).position!;
      return absolutize(markdown.slice(start.offset, end.offset).replace(/\s*\n\s*/g, ' '));
    }
  }
  return null;
}

/** Todae exports named in the recipe's code blocks, such as `Disclosure.Root` and `useInlineEdit`. Names have at most one dot. */
export function exportsIn(markdown: string): string[] {
  const code: string[] = [];
  const visit = (node: Node) => {
    if (node.type === 'code') code.push((node as Code).value);
    else if ('children' in node) for (const child of node.children as Node[]) visit(child);
  };
  visit(parse(markdown));
  const tokens = new Set(code.join('\n').match(/(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) ?? []);
  return [...tokens].filter((token) => NAMES.has(token)).sort();
}

const pages = listPages()
  .filter((page) => page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
  .sort((a, b) => a.slug.localeCompare(b.slug));

/** What `get_recipe` returns for each recipe. */
const recipes = pages.map((page) => {
  const copy = parseWhen(page.markdown, page.title);
  return {
    name: page.slug.slice(PREFIX.length),
    title: page.title,
    markdown: absolutize(page.markdown),
    whenToUse: copy?.whenToUse ?? null,
    whenNotToUse: copy?.whenNotToUse ?? null,
    docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
    source: SOURCE,
  };
});

/** What `list_recipes` returns. */
const listing = (() => {
  const rows = pages.map((page, index) => {
    const recipe = recipes[index]!;
    return {
      name: recipe.name,
      title: recipe.title,
      description: summaryOf(page.markdown),
      uses: exportsIn(page.markdown),
      docsUrl: recipe.docsUrl,
      hasWhenToUse: recipe.whenToUse != null,
    };
  });
  return { recipes: rows, count: rows.length, source: SOURCE };
})();

export function listRecipes() {
  return listing;
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string) {
  const folded = query.trim().toLowerCase();
  const recipe = recipes.find((row) => row.name === folded || row.title.toLowerCase() === folded);
  if (!recipe) throw new Error(`Unknown recipe "${query}". Call list_recipes.`);
  return recipe;
}
