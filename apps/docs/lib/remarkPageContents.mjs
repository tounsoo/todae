import { pageOf } from './remarkPageMetadata.mjs';

// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.

/** A node's text as a reader sees it: code keeps its text, markup and JSX attributes drop out. */
function plainText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return (node.children ?? []).map(plainText).join('');
}

/**
 * A heading's id, as GitHub writes one: lower case, punctuation dropped, spaces
 * as hyphens, with `-1`, `-2` and so on after a repeat. Letters of any script
 * stay, so a Korean heading gets a Korean id.
 */
export function slugOf(text, seen) {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-') || 'section';
  let slug = base;
  for (let n = 1; seen.has(slug); n++) slug = `${base}-${n}`;
  seen.add(slug);
  return slug;
}

// A heading may end in `{/*#id*/}` to keep one id in every language. Translations copy
// link targets, and a slug of the heading's own words would not match.
const EXPLICIT_ID = /^#([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** The id a heading names for itself, removed so it is not part of the heading. */
function explicitId(node) {
  const last = node.children?.at(-1);
  if (last?.type !== 'mdxTextExpression') return null;
  const comment = /^\s*\/\*([\s\S]*?)\*\/\s*$/.exec(last.value);
  if (!comment) return null;
  const body = comment[1].trim();
  if (!body.startsWith('#')) return null;
  const id = EXPLICIT_ID.exec(body)?.[1];
  if (!id) throw new Error(`Heading id "${body}" must be lowercase letters, digits and hyphens`);
  node.children.pop();
  const prev = node.children.at(-1);
  if (prev?.type === 'text') prev.value = prev.value.trimEnd();
  return id;
}

function headingId(node, seen) {
  const declared = explicitId(node);
  const text = plainText(node).replace(/\s+/g, ' ').trim();
  if (!declared) return { id: slugOf(text, seen), text };
  if (seen.has(declared)) throw new Error(`Heading "${text}" asks for #${declared}, which an earlier heading already uses`);
  seen.add(declared);
  return { id: declared, text };
}

/**
 * The page's sections: each `##` heading with the `###` headings under it, in
 * order. It gives each of those headings its id. Headings inside JSX, such as
 * in a demo, are not sections of the page.
 */
export function pageSections(tree) {
  const seen = new Set();
  const sections = [];
  for (const node of tree.children) {
    if (node.type !== 'heading' || node.depth < 2 || node.depth > 3) continue;
    const { id, text } = headingId(node, seen);
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    const entry = { id, text, children: [] };
    if (node.depth === 2 || sections.length === 0) sections.push(entry);
    else sections.at(-1).children.push(entry);
  }
  return sections;
}

const jsx = (name, attributes, children = []) => ({
  type: 'mdxJsxFlowElement',
  name,
  attributes: Object.entries(attributes).map(([key, value]) => ({ type: 'mdxJsxAttribute', name: key, value })),
  children,
});

/**
 * Gives every docs page its sections' ids and a list of them. The page's
 * content goes inside `DocsPage`, which shows the list beside it on wide
 * screens, and `PageContentsFold` after the lede shows it folded on narrow ones.
 * ES module nodes stay at the top, where MDX needs them.
 */
export default function remarkPageContents() {
  return (tree, file) => {
    const page = file.path ? pageOf(file.path) : null;
    if (!page) return;
    const sections = pageSections(tree);
    const contents = JSON.stringify(sections.length >= 2 ? sections : []);
    const esm = tree.children.filter((node) => node.type === 'mdxjsEsm');
    const body = tree.children.filter((node) => node.type !== 'mdxjsEsm');
    if (sections.length >= 2) {
      const title = body.findIndex((node) => node.type === 'heading' && node.depth === 1);
      const lede = title >= 0 && body[title + 1]?.type === 'paragraph' ? title + 1 : title;
      body.splice(lede + 1, 0, jsx('PageContentsFold', { locale: page.locale, contents }));
    }
    tree.children = [...esm, jsx('DocsPage', { locale: page.locale, contents }, body)];
  };
}
