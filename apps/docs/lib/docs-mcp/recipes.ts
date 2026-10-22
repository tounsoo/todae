import { DOCS_ORIGIN } from '../origin';
import { absolutize, listPages, parseWhen, type PageDoc } from './mdx';
import { listComponentMeta } from './meta';

const SOURCE = 'todae-docs' as const;
const PREFIX = 'recipes/';

function recipePages(): PageDoc[] {
  return listPages()
    .filter((page) => page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The first paragraph after the title: the page's one-line summary. */
export function summaryOf(markdown: string): string | null {
  const lines = markdown.split('\n');
  const title = lines.findIndex((line) => line.startsWith('# '));
  const paragraph: string[] = [];
  for (const line of lines.slice(title + 1)) {
    if (!line.trim()) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (/^(#|<|```|import |export )/.test(line)) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.length > 0 ? absolutize(paragraph.join(' ')) : null;
}

/** Todae exports named in the recipe's code blocks, such as `Disclosure.Root` and `useInlineEdit`. */
export function exportsIn(markdown: string): string[] {
  const code = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((hit) => hit[1] ?? '').join('\n');
  return listComponentMeta()
    .map((row) => row.name)
    .filter((name) => new RegExp(`(?<![\\w.])${name.replace('.', '\\.')}(?![\\w])`).test(code))
    .sort();
}

function recipeName(page: PageDoc): string {
  return page.slug.slice(PREFIX.length);
}

export function listRecipes() {
  const recipes = recipePages().map((page) => ({
    name: recipeName(page),
    title: page.title,
    // Every recipe page opens by saying it is one; the tool's description already does.
    description: summaryOf(page.markdown)?.replace(/^A recipe, not a package namespace\. /, '') ?? null,
    uses: exportsIn(page.markdown),
    docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
    hasWhenToUse: parseWhen(page.markdown, page.title) != null,
  }));
  return { recipes, count: recipes.length, source: SOURCE };
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string) {
  const folded = query.trim().toLowerCase();
  const page = recipePages().find((row) => recipeName(row) === folded || row.title.toLowerCase() === folded);
  if (!page) throw new Error(`Unknown recipe "${query}". Call list_recipes.`);
  const copy = parseWhen(page.markdown, page.title);
  return {
    name: recipeName(page),
    title: page.title,
    markdown: absolutize(page.markdown),
    whenToUse: copy?.whenToUse ?? null,
    whenNotToUse: copy?.whenNotToUse ?? null,
    docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
    source: SOURCE,
  };
}
