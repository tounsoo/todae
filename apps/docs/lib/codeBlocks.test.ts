import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exampleSource } from './exampleSource.mjs';
import { codeBlocks } from './mdxAst';

const APP = join(process.cwd(), 'app');
const EXAMPLES = join(process.cwd(), 'examples');
// `text` is for a block that is not code, such as the list of patterns under Composition's Never.
const LANGUAGES = new Set(['tsx', 'ts', 'css', 'json', 'sh', 'text']);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

/** Each fenced block as its language and body, named by its page and its place on the page, and the code and stylesheets of each example file. */
function blocks(): { name: string; lang: string; body: string }[] {
  const examples = readdirSync(EXAMPLES, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx') || file.endsWith('.css'))
    .map((file) => {
      const text = readFileSync(join(EXAMPLES, file), 'utf8');
      return file.endsWith('.css') ? { name: `examples/${file}`, lang: 'css', body: text } : { name: `examples/${file}`, lang: 'tsx', body: exampleSource(text) };
    });
  return [
    ...examples,
    ...pages(APP).flatMap((path) =>
      codeBlocks(readFileSync(path, 'utf8')).code.map((source, index) => {
        const [fence = '', ...lines] = source.split('\n');
        return { name: `${relative(APP, path)} #${index + 1}`, lang: fence.replace(/^`+/, '').trim(), body: lines.slice(0, -1).join('\n') };
      }),
    ),
  ];
}

describe('docs code blocks', () => {
  const all = blocks();

  it('finds the code blocks', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('name a language', () => {
    const bad = all.filter(({ lang }) => !LANGUAGES.has(lang)).map(({ name }) => name);
    expect(bad, `Give each of these fences (page #block, counted from 1) one of ${[...LANGUAGES].join(', ')} after the backticks, in the English page and its Korean twin`).toEqual([]);
  });

  it('indent with spaces', () => {
    const bad = all.filter(({ body }) => /^\t/m.test(body)).map(({ name }) => name);
    expect(bad, 'Indent these blocks (page #block, counted from 1) with two spaces per level instead of tabs, in the English page and its Korean twin').toEqual([]);
  });

  it('mark left-out content with an ellipsis, not three dots', () => {
    // `...` followed by a name, call or literal is a spread or rest.
    const bad = all.filter(({ body }) => /\.\.\.(?![\w({[])/.test(body)).map(({ name }) => name);
    expect(bad, 'Write left-out content in these blocks (page #block, counted from 1) as … (U+2026), in the English page and its Korean twin').toEqual([]);
  });
});
