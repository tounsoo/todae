import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.

const APP_DIR = fileURLToPath(new URL('../app/', import.meta.url));
const PAGE_METADATA = fileURLToPath(new URL('./i18n/metadata.ts', import.meta.url));

/** Longest description a page gets. Link previews and search results cut near here anyway. */
export const DESCRIPTION_LIMIT = 200;

/** The locale and slug of a docs page file, or null when the file is not a page. */
export function pageOf(file, appDir = APP_DIR) {
  const parts = relative(appDir, file).split(sep);
  if (parts.at(-1) !== 'page.mdx' || parts[0]?.startsWith('..')) return null;
  const [dir, ...rest] = parts.slice(0, -1);
  const locale = dir === '(en)' ? 'en' : dir === 'ko' ? 'ko' : null;
  return locale ? { locale, slug: rest.join('/') } : null;
}

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

const literal = (value) => ({ type: 'Literal', value, raw: JSON.stringify(value) });
const identifier = (name) => ({ type: 'Identifier', name });

/** `import { pageMetadata } from '…'; export const metadata = pageMetadata({ … });` as an MDX ESM node. */
function metadataExport(fields) {
  const call = {
    type: 'CallExpression',
    callee: identifier('pageMetadata'),
    optional: false,
    arguments: [
      {
        type: 'ObjectExpression',
        properties: Object.entries(fields).map(([key, value]) => ({
          type: 'Property',
          kind: 'init',
          method: false,
          shorthand: false,
          computed: false,
          key: identifier(key),
          value: literal(value),
        })),
      },
    ],
  };
  const program = {
    type: 'Program',
    sourceType: 'module',
    body: [
      {
        type: 'ImportDeclaration',
        specifiers: [{ type: 'ImportSpecifier', imported: identifier('pageMetadata'), local: identifier('pageMetadata') }],
        source: literal(PAGE_METADATA),
      },
      {
        type: 'ExportNamedDeclaration',
        specifiers: [],
        source: null,
        declaration: {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [{ type: 'VariableDeclarator', id: identifier('metadata'), init: call }],
        },
      },
    ],
  };
  return { type: 'mdxjsEsm', value: '', data: { estree: program } };
}

/**
 * Gives every docs page its own `metadata` export, built by `pageMetadata` from
 * the page's own title and first paragraph, so a link to it previews with what
 * it says. A page that exports `metadata` itself keeps its own.
 */
export default function remarkPageMetadata() {
  return (tree, file) => {
    const page = file.path ? pageOf(file.path) : null;
    if (!page) return;
    const exportsMetadata = tree.children.some(
      (node) => node.type === 'mdxjsEsm' && /\bexport\s+(const|let|var|function|async function)\s+(metadata|generateMetadata)\b/.test(node.value),
    );
    if (exportsMetadata) return;
    const summary = pageSummary(tree);
    if (!summary) throw new Error(`${file.path} has no # title to describe it by`);
    tree.children.push(metadataExport({ ...page, ...summary }));
  };
}
