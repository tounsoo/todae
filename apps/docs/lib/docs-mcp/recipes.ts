import { DOCS_ORIGIN } from '../origin';
import { absolutize, listPages, parseWhen } from './mdx';
import { listComponentMeta } from './meta';

const SOURCE = 'todae-docs' as const;
const PREFIX = 'recipes/';

const NOT_PROSE = /^(\s|<|`{3}|#|\{|\||import\s|export\s)/;

/** The intro's first prose paragraph: after the title and before the first `##`, past imports, JSX and code fences, and ending before any of them. */
export function summaryOf(markdown: string): string | null {
  const lines = markdown.split('\n');
  const paragraph: string[] = [];
  let fenced = false;
  for (const line of lines.slice(lines.findIndex((row) => row.startsWith('# ')) + 1)) {
    const fence = line.startsWith('```');
    if (!fenced && line.startsWith('## ')) break;
    if (paragraph.length > 0 && (!line.trim() || NOT_PROSE.test(line))) break;
    if (fence) fenced = !fenced;
    if (fenced || fence || !line.trim() || NOT_PROSE.test(line)) continue;
    paragraph.push(line.trim());
  }
  return paragraph.length > 0 ? absolutize(paragraph.join(' ')) : null;
}

const NAMES = new Set(listComponentMeta().map((row) => row.name));

/** Todae exports named in the recipe's code blocks, such as `Disclosure.Root` and `useInlineEdit`. Names have at most one dot. */
export function exportsIn(markdown: string): string[] {
  const code = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((hit) => hit[1] ?? '').join('\n');
  const tokens = new Set(code.match(/(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) ?? []);
  return [...tokens].filter((token) => NAMES.has(token)).sort();
}

const recipes = listPages()
  .filter((page) => page.slug.startsWith(PREFIX) && !page.slug.slice(PREFIX.length).includes('/'))
  .sort((a, b) => a.slug.localeCompare(b.slug))
  .map((page) => {
    const copy = parseWhen(page.markdown, page.title);
    return {
      name: page.slug.slice(PREFIX.length),
      title: page.title,
      description: summaryOf(page.markdown),
      uses: exportsIn(page.markdown),
      docsUrl: `${DOCS_ORIGIN}/${page.slug}`,
      markdown: absolutize(page.markdown),
      whenToUse: copy?.whenToUse ?? null,
      whenNotToUse: copy?.whenNotToUse ?? null,
    };
  });

export function listRecipes() {
  const rows = recipes.map(({ name, title, description, uses, docsUrl, whenToUse }) => ({
    name,
    title,
    description,
    uses,
    docsUrl,
    hasWhenToUse: whenToUse != null,
  }));
  return { recipes: rows, count: rows.length, source: SOURCE };
}

/** By name, such as "data-table", or title, such as "Data table", ignoring case. */
export function getRecipe(query: string) {
  const folded = query.trim().toLowerCase();
  const recipe = recipes.find((row) => row.name === folded || row.title.toLowerCase() === folded);
  if (!recipe) throw new Error(`Unknown recipe "${query}". Call list_recipes.`);
  const { description: _description, uses: _uses, ...page } = recipe;
  return { ...page, source: SOURCE };
}
