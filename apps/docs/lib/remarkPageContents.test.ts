import { join } from 'node:path';
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { describe, expect, it } from 'vitest';
import remarkPageContents, { pageSections, slugOf } from './remarkPageContents.mjs';

const APP = join(process.cwd(), 'app');

function parse(mdx: string): Root {
  return fromMarkdown(mdx, { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
}

const PAGE = `import { Demo } from './Demo';

# Button

The lede.

## Usage

### With \`icon\`

## Usage

<Demo>

## Inside a demo

</Demo>
`;

describe('page contents', () => {
  it('writes GitHub-style ids that keep letters of any script and number repeats', () => {
    const seen = new Set<string>();
    expect(slugOf('Accessible composition', seen)).toBe('accessible-composition');
    expect(slugOf('Accessible composition', seen)).toBe('accessible-composition-1');
    expect(slugOf('Button.Root: `as`?', seen)).toBe('buttonroot-as');
    expect(slugOf('접근성을 지키는 조합', seen)).toBe('접근성을-지키는-조합');
  });

  it('uses an id a heading names, in place of a slug of its words', () => {
    const tree = parse('## 서버 오류 {/*#server-errors*/}\n\n## Server errors\n');
    expect(pageSections(tree)).toEqual([
      { id: 'server-errors', text: '서버 오류', children: [] },
      { id: 'server-errors-1', text: 'Server errors', children: [] },
    ]);
    const heading = tree.children[0];
    expect(heading && 'children' in heading && heading.children.some((child) => child.type === 'mdxTextExpression')).toBe(false);
  });

  it('refuses an id an earlier heading already uses', () => {
    const tree = parse('## Server errors\n\n## 서버 오류 {/*#server-errors*/}\n');
    expect(() => pageSections(tree)).toThrow(/#server-errors/);
  });

  it('lists each ## section with the ### sections under it, and gives their headings ids', () => {
    const tree = parse(PAGE);
    expect(pageSections(tree)).toEqual([
      { id: 'usage', text: 'Usage', children: [{ id: 'with-icon', text: 'With icon', children: [] }] },
      { id: 'usage-1', text: 'Usage', children: [] },
    ]);
    const heading = tree.children.find((node) => node.type === 'heading' && node.depth === 3);
    expect(heading?.data).toEqual({ hProperties: { id: 'with-icon' } });
  });

  it('keeps imports at the top, wraps the page in DocsPage and folds the list under the lede', () => {
    const tree = parse(PAGE);
    remarkPageContents()(tree, { path: join(APP, 'ko', 'button', 'page.mdx') });
    expect(tree.children.map((node) => node.type)).toEqual(['mdxjsEsm', 'mdxJsxFlowElement']);
    const page = tree.children[1] as unknown as { name: string; attributes: { name: string; value: string }[]; children: { type: string; name?: string }[] };
    expect(page.name).toBe('DocsPage');
    expect(page.attributes.find((attribute) => attribute.name === 'locale')?.value).toBe('ko');
    expect(JSON.parse(page.attributes.find((attribute) => attribute.name === 'contents')!.value)).toHaveLength(2);
    expect(page.children.slice(0, 3).map((node) => node.name ?? node.type)).toEqual(['heading', 'paragraph', 'PageContentsFold']);
  });

  it('gives a page with fewer than two sections no list', () => {
    const tree = parse('# Page\n\nText.\n\n## Only\n');
    remarkPageContents()(tree, { path: join(APP, '(en)', 'page', 'page.mdx') });
    const page = tree.children[0] as unknown as { attributes: { name: string; value: string }[]; children: { name?: string }[] };
    expect(page.attributes.find((attribute) => attribute.name === 'contents')?.value).toBe('[]');
    expect(page.children.some((node) => node.name === 'PageContentsFold')).toBe(false);
  });
});
