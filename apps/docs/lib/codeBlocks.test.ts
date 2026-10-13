import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeBlocks } from './i18n/sections';

const APP = join(process.cwd(), 'app');
const LANGUAGES = new Set(['tsx', 'ts', 'css', 'json', 'sh']);

// Pages whose code blocks don't follow the conventions yet. Bring them in line, then remove them here.
const PENDING = new Set(['composition', 'field', 'utilities/strings-provider']);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

/** Each fenced block as its language and body, named by its page and its place on the page. */
function blocks(): { name: string; lang: string; body: string }[] {
  return pages(APP)
    .filter((path) => !PENDING.has(relative(APP, path).split(sep).slice(1, -1).join('/')))
    .flatMap((path) =>
      codeBlocks(readFileSync(path, 'utf8')).code.map((source, index) => {
        const [fence = '', ...lines] = source.split('\n');
        return { name: `${relative(APP, path)} #${index + 1}`, lang: fence.replace(/^`+/, '').trim(), body: lines.slice(0, -1).join('\n') };
      }),
    );
}

describe('docs code blocks', () => {
  const all = blocks();

  it('finds the code blocks', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('name a language', () => {
    expect(all.filter(({ lang }) => !LANGUAGES.has(lang)).map(({ name }) => name)).toEqual([]);
  });

  it('indent with spaces', () => {
    expect(all.filter(({ body }) => /^\t/m.test(body)).map(({ name }) => name)).toEqual([]);
  });

  it('mark left-out content with an ellipsis, not three dots', () => {
    // `...` followed by a name, call or literal is a spread or rest.
    expect(all.filter(({ body }) => /\.\.\.(?![\w({[])/.test(body)).map(({ name }) => name)).toEqual([]);
  });
});
