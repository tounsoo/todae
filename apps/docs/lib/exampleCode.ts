import { readFileSync } from 'node:fs';
import type { Node } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx';
import { exampleSource } from './exampleSource.mjs';
import { parseMdx } from './mdxAst';
import { defaultImports, exampleFile } from './remarkExamples.mjs';

/** The name an `<Example of={Name}>` element shows, or null for an `<Example>` with children. */
export function exampleOf(node: Node): string | null {
  if (node.type !== 'mdxJsxFlowElement' || (node as MdxJsxFlowElement).name !== 'Example') return null;
  const of = (node as MdxJsxFlowElement).attributes.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'of');
  return of && typeof of.value === 'object' && of.value ? of.value.value.trim() : null;
}

/**
 * The page at `pagePath` as a reader sees it: each `<Example of={Name} />` gets the code of its
 * example file in a fence above it, as `remarkExamples` renders it. For tools that read the MDX
 * itself, such as the MCP and the code block checks.
 */
export function withExampleCode(pagePath: string, mdx: string): string {
  const tree = parseMdx(mdx);
  const imports = defaultImports(tree);
  const inserts: { at: number; code: string }[] = [];
  const visit = (node: Node) => {
    const name = exampleOf(node);
    if (name) {
      const code = exampleSource(readFileSync(exampleFile(pagePath, imports, name), 'utf8'));
      inserts.push({ at: node.position!.start.offset!, code: `\`\`\`tsx\n${code}\n\`\`\`\n\n` });
    } else if ('children' in node) {
      for (const child of node.children as Node[]) visit(child);
    }
  };
  visit(tree);
  let out = mdx;
  for (const { at, code } of inserts.reverse()) out = out.slice(0, at) + code + out.slice(at);
  return out;
}
