import type { Node, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';

/** `mdx` as the MDX compiler parses it. */
export function parseMdx(mdx: string): Root {
  return fromMarkdown(mdx, { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
}

const start = (node: Node) => node.position!.start.offset!;
const end = (node: Node) => node.position!.end.offset!;

/** The source of every code block in `mdx`, at any depth, and `mdx` with them removed. */
export function codeBlocks(mdx: string, tree: Root = parseMdx(mdx)): { code: string[]; rest: string } {
  const code: string[] = [];
  let rest = '';
  let from = 0;
  const visit = (node: Node) => {
    if (node.type === 'code') {
      code.push(mdx.slice(start(node), end(node)));
      rest += mdx.slice(from, start(node));
      from = end(node);
    } else if ('children' in node) {
      for (const child of node.children as Node[]) visit(child);
    }
  };
  visit(tree);
  return { code, rest: rest + mdx.slice(from) };
}
