import { codeBlocks, parseMdx } from '../mdxAst';
import { DOCS_ORIGIN } from '../origin';
import { pageSummary } from '../pageSummary.mjs';
import { absolutize, listPages, parseWhen, type PageDoc } from './mdx';
import { listComponentMeta } from './meta';

const SOURCE = 'todae-docs' as const;
const PREFIX = 'recipes/';

const NAMES = new Set(listComponentMeta().map((row) => row.name));

/** Todae exports named in `code`, such as `Disclosure.Root` and `useInlineEdit`. Names have at most one dot; a fence's language tag is never one. */
export function exportsIn(code: string): string[] {
  const tokens = new Set(code.match(/(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) ?? []);
  return [...tokens].filter((token) => NAMES.has(token)).sort();
}

function readRecipe(page: PageDoc) {
  const tree = parseMdx(page.markdown);
  const copy = parseWhen(page.markdown, page.title);
  const name = page.slug.slice(PREFIX.length);
  const docsUrl = `${DOCS_ORIGIN}/${page.slug}`;
  const whenToUse = copy?.whenToUse ?? null;
  return {
    row: {
      name,
      title: page.title,
      // The intro paragraph, between the title and the first section, as the page's link preview reads it but not cut short.
      description: pageSummary(tree, Infinity)?.description || null,
      uses: exportsIn(codeBlocks(page.markdown, tree).code.join('\n')),
      docsUrl,
      hasWhenToUse: whenToUse != null,
    },
    detail: {
      name,
      title: page.title,
      markdown: absolutize(page.markdown),
      whenToUse,
      whenNotToUse: copy?.whenNotToUse ?? null,
      docsUrl,
      source: SOURCE,
    },
  };
}

let recipes: ReturnType<typeof readRecipe>[] | undefined;

/** Read on first use, so a page that fails to parse fails the recipe tools alone. */
function allRecipes() {
  recipes ??= listPages()
    .filter((page) => page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(readRecipe);
  return recipes;
}

export function listRecipes() {
  const rows = allRecipes().map((recipe) => recipe.row);
  return { recipes: rows, count: rows.length, source: SOURCE };
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string) {
  const folded = query.trim().toLowerCase();
  const recipe = allRecipes().find(({ detail }) => detail.name === folded || detail.title.toLowerCase() === folded);
  if (!recipe) throw new Error(`Unknown recipe "${query}". Call list_recipes.`);
  return recipe.detail;
}
