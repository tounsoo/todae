import { DOCS_ORIGIN } from '../origin';
import { absolutize, listPages, parseWhen, type PageDoc } from './mdx';
import { listComponentMeta } from './meta';

const SOURCE = 'todae-docs' as const;
const PREFIX = 'recipes/';

/** The first prose paragraph after the title, skipping imports, JSX and code fences. */
export function summaryOf(markdown: string): string | null {
  const lines = markdown.split('\n');
  const title = lines.findIndex((line) => line.startsWith('# '));
  const blocks: string[][] = [];
  let block: string[] = [];
  let fenced = false;
  for (const line of lines.slice(title + 1)) {
    if (line.startsWith('```')) fenced = !fenced;
    if (!fenced && !line.trim()) {
      if (block.length > 0) blocks.push(block);
      block = [];
      continue;
    }
    block.push(line);
  }
  if (block.length > 0) blocks.push(block);
  const prose = blocks.find(
    (lines) => /^(?!```)[A-Za-z[`*_]/.test(lines[0] ?? '') && !/^(import|export)\s/.test(lines[0] ?? ''),
  );
  return prose ? absolutize(prose.map((line) => line.trim()).join(' ')) : null;
}

/** Todae exports named in the recipe's code blocks, such as `Disclosure.Root` and `useInlineEdit`. */
export function exportsIn(markdown: string): string[] {
  const names = new Set(listComponentMeta().map((row) => row.name));
  const code = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((hit) => hit[1] ?? '').join('\n');
  const tokens = new Set(code.match(/(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) ?? []);
  return [...tokens].filter((token) => names.has(token)).sort();
}

type Recipe = { name: string; page: PageDoc; docsUrl: string };

const recipes: Recipe[] = listPages()
  .filter((page) => page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
  .sort((a, b) => a.slug.localeCompare(b.slug))
  .map((page) => ({ name: page.slug.slice(PREFIX.length), page, docsUrl: `${DOCS_ORIGIN}/${page.slug}` }));

export function listRecipes() {
  const rows = recipes.map(({ name, page, docsUrl }) => ({
    name,
    title: page.title,
    description: summaryOf(page.markdown),
    uses: exportsIn(page.markdown),
    docsUrl,
    hasWhenToUse: parseWhen(page.markdown, page.title)?.whenToUse != null,
  }));
  return { recipes: rows, count: rows.length, source: SOURCE };
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string) {
  const folded = query.trim().toLowerCase();
  const recipe = recipes.find((row) => row.name === folded || row.page.title.toLowerCase() === folded);
  if (!recipe) throw new Error(`Unknown recipe "${query}". Call list_recipes.`);
  const copy = parseWhen(recipe.page.markdown, recipe.page.title);
  return {
    name: recipe.name,
    title: recipe.page.title,
    markdown: absolutize(recipe.page.markdown),
    whenToUse: copy?.whenToUse ?? null,
    whenNotToUse: copy?.whenNotToUse ?? null,
    docsUrl: recipe.docsUrl,
    source: SOURCE,
  };
}
