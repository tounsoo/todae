import type { Node } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx';
import { parseMdx } from './mdxAst';
import { defaultImports, exampleBlocks, exampleFile } from './remarkExamples.mjs';

/** The name an `<Example of={Name}>` element shows, or null for any other node. */
export function exampleOf(node: Node): string | null {
  if (node.type !== 'mdxJsxFlowElement' || (node as MdxJsxFlowElement).name !== 'Example') return null;
  const of = (node as MdxJsxFlowElement).attributes.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'of');
  return of && typeof of.value === 'object' && of.value ? of.value.value.trim() : null;
}

/**
 * The page at `pagePath` as a reader sees it: each `<Example of={Name} />` gets the code of its
 * example file, and of any stylesheet that file imports from its folder and the page has not shown yet,
 * in fences above it, as
 * `remarkExamples` renders it. For tools that read the MDX itself, such as the MCP and the code
 * block checks.
 */
export function withExampleCode(pagePath: string, mdx: string): string {
  const tree = parseMdx(mdx);
  const imports = defaultImports(tree);
  const shown = new Set<string>();
  const inserts: { at: number; code: string }[] = [];
  const visit = (node: Node) => {
    const name = exampleOf(node);
    if (name) {
      const blocks = exampleBlocks(exampleFile(pagePath, imports, name), shown);
      inserts.push({ at: node.position!.start.offset!, code: blocks.map(({ lang, value }) => `\`\`\`${lang}\n${value}\n\`\`\`\n\n`).join('') });
    } else if ('children' in node) {
      for (const child of node.children as Node[]) visit(child);
    }
  };
  visit(tree);
  let out = mdx;
  for (const { at, code } of inserts.reverse()) out = out.slice(0, at) + code + out.slice(at);
  return out;
}
