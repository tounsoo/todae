// Plain JavaScript: remarkPageMetadata.mjs, which next.config.mjs loads, imports it. It has no file paths, so the docs MCP route can bundle it.

/** Longest description a page gets. Link previews and search results cut near here anyway. */
export const DESCRIPTION_LIMIT = 200;

/** A node's text as a reader sees it: code keeps its text, markup and JSX attributes drop out. */
function plainText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return (node.children ?? []).map(plainText).join('');
}

/** The first paragraph, cut at a sentence end, or at a word with an ellipsis, when it runs past `limit`. */
export function summarize(text, limit = DESCRIPTION_LIMIT) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const head = flat.slice(0, limit);
  const sentence = head.lastIndexOf('. ');
  if (sentence > limit / 3) return head.slice(0, sentence + 1);
  const word = head.lastIndexOf(' ');
  return `${head.slice(0, word > 0 ? word : limit).replace(/[\s,;:]+$/, '')}…`;
}

/** The page's title (its `# heading`) and description (the first paragraph after it). */
export function pageSummary(tree) {
  const index = tree.children.findIndex((node) => node.type === 'heading' && node.depth === 1);
  if (index < 0) return null;
  const paragraph = tree.children.slice(index + 1).find((node) => node.type === 'paragraph');
  const title = plainText(tree.children[index]).trim();
  return { title, description: paragraph ? summarize(plainText(paragraph)) : '' };
}
