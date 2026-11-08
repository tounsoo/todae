// Plain JavaScript: remarkPageMetadata.mjs, which next.config.mjs loads, imports it. It has no file paths, so the docs MCP route can bundle it.

/**
 * Widest description a page gets, in `descriptionWidth` units. Search results
 * cut a snippet by its drawn width, near 160 Latin letters, so a longer
 * description loses its end there.
 */
export const DESCRIPTION_LIMIT = 160;

/** Narrowest description a page gets, in the same units. A shorter one says too little to tell the page apart in a search result. */
export const DESCRIPTION_MIN = 50;

// Hangul, CJK and full-width forms draw about twice as wide as a Latin letter.
const WIDE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-｠￠-￦]/u;

/** How wide `text` draws, counting a wide character as two Latin letters. */
export function descriptionWidth(text) {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

/** A node's text as a reader sees it: code keeps its text, markup and JSX attributes drop out. */
function plainText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return ' ';
  // `{' '}` and other string literals in MDX text are text too.
  if (node.type === 'mdxTextExpression') return /^\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*$/s.exec(node.value)?.[2].replace(/\\(.)/g, '$1') ?? '';
  return (node.children ?? []).map(plainText).join('');
}

// A period after one of these ends an abbreviation, not a sentence.
// The last sentence ends in . ! or ? (or their CJK forms), perhaps inside a closing quote or bracket.
const SENTENCE_END = /[.!?。！？]["'”’)\]」』]*$/;

const ABBREVIATION = /\b(?:e\.g|i\.e|vs|etc|cf|approx)$/i;

/**
 * The paragraph's opening sentences, as many whole ones as fit in `limit`.
 * Empty when even the first sentence does not fit: a description never stops
 * mid-sentence. A paragraph that ends in anything else, such as a colon
 * leading into a list, loses that unfinished part too.
 */
export function summarize(text, limit = DESCRIPTION_LIMIT) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (descriptionWidth(flat) <= limit && SENTENCE_END.test(flat)) return flat;
  let fits = '';
  for (const end of flat.matchAll(/[.!?]["'”’)\]」』]*(?= )|[。！？]["'”’)\]」』]*/g)) {
    const head = flat.slice(0, end.index + end[0].length).trimEnd();
    if (ABBREVIATION.test(head.replace(/[.!?]["'”’)\]」』]*$/, ''))) continue;
    if (descriptionWidth(head) > limit) break;
    fits = head;
  }
  return fits;
}

/** The page's title (its `# heading`) and description (the first paragraph between it and the next heading, or empty). */
export function pageSummary(tree, limit = DESCRIPTION_LIMIT) {
  const index = tree.children.findIndex((node) => node.type === 'heading' && node.depth === 1);
  if (index < 0) return null;
  const rest = tree.children.slice(index + 1);
  const end = rest.findIndex((node) => node.type === 'heading');
  const paragraph = rest.slice(0, end < 0 ? rest.length : end).find((node) => node.type === 'paragraph');
  const title = plainText(tree.children[index]).trim();
  return { title, description: paragraph ? summarize(plainText(paragraph), limit) : '' };
}
