import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Code, Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { describe, expect, it } from 'vitest';

const APP = join(process.cwd(), 'app');
const LANGUAGES = new Set(['tsx', 'ts', 'css', 'json', 'sh']);

// Pages the ColorPicker pull request (#123) rewrites. Bring them in line once it lands.
const PENDING = new Set(['composition', 'field', 'field/color-input', 'utilities/strings-provider']);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

function blocks(): { page: string; code: Code }[] {
  return pages(APP)
    .filter((path) => {
      const slug = relative(APP, path).split(sep).slice(1, -1).join('/');
      return !PENDING.has(slug);
    })
    .flatMap((path) => {
      const tree = fromMarkdown(readFileSync(path, 'utf8'), { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
      const found: { page: string; code: Code }[] = [];
      const walk = (node: Nodes) => {
        if (node.type === 'code') found.push({ page: `${relative(APP, path)}:${node.position?.start.line}`, code: node });
        if ('children' in node) node.children.forEach((child) => walk(child as Nodes));
      };
      walk(tree);
      return found;
    });
}

describe('docs code blocks', () => {
  const all = blocks();

  it('finds the code blocks', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('name a language', () => {
    expect(all.filter(({ code }) => !LANGUAGES.has(code.lang ?? '')).map(({ page }) => page)).toEqual([]);
  });

  it('indent with spaces', () => {
    expect(all.filter(({ code }) => /^\t/m.test(code.value)).map(({ page }) => page)).toEqual([]);
  });

  it('mark left-out content with an ellipsis, not three dots', () => {
    // `...` followed by a name, call or literal is a spread or rest.
    expect(all.filter(({ code }) => /\.\.\.(?![\w({[])/.test(code.value)).map(({ page }) => page)).toEqual([]);
  });
});
