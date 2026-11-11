import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESCRIPTION_LIMIT, DESCRIPTION_MIN, descriptionWidth, pageSummary } from './pageSummary.mjs';

// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.

const APP_DIR = fileURLToPath(new URL('../app/', import.meta.url));
const PAGE_METADATA = fileURLToPath(new URL('./i18n/metadata.ts', import.meta.url));

/** The locale and slug of a docs page file, or null when the file is not a page. */
export function pageOf(file, appDir = APP_DIR) {
  const parts = relative(appDir, file).split(sep);
  if (parts.at(-1) !== 'page.mdx' || parts[0]?.startsWith('..')) return null;
  const [dir, ...rest] = parts.slice(0, -1);
  const locale = dir === '(en)' ? 'en' : dir === 'ko' ? 'ko' : null;
  return locale ? { locale, slug: rest.join('/') } : null;
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

/** The string a page exports as `description`, or null when it exports none. */
export function ownDescription(tree) {
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    for (const statement of node.data?.estree?.body ?? []) {
      const declarations = statement.type === 'ExportNamedDeclaration' ? (statement.declaration?.declarations ?? []) : [];
      const own = declarations.find((declaration) => declaration.id?.name === 'description');
      if (!own) continue;
      if (own.init?.type !== 'Literal' || typeof own.init.value !== 'string') throw new Error('`export const description` must be a plain string');
      return own.init.value;
    }
  }
  return null;
}

/**
 * Gives every docs page its own `metadata` export, built by `pageMetadata` from
 * the page's own title and description, so a link to it previews with what it
 * says. The description is the page's `export const description`, else the
 * opening sentences of its intro paragraph that fit a search result. A page
 * whose intro gives none that fit, or too short a one, must export its own.
 * A page that exports `metadata` itself keeps its own.
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
    const own = ownDescription(tree);
    const description = own ?? summary.description;
    const width = descriptionWidth(description);
    if (width < DESCRIPTION_MIN || width > DESCRIPTION_LIMIT) {
      const why = own === null ? "its intro paragraph's opening sentences don't make one" : `its own is ${width} wide`;
      throw new Error(
        `${file.path} needs a description ${DESCRIPTION_MIN} to ${DESCRIPTION_LIMIT} wide (a Hangul or CJK character counts as 2), and ${why}. Write one as \`export const description = '…';\` under the imports.`,
      );
    }
    tree.children.push(metadataExport({ ...page, title: summary.title, description }));
  };
}
