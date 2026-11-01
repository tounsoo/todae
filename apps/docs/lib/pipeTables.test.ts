import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(process.cwd(), 'app');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

// A GFM separator. The docs MDX pipeline has no GFM, so this line stays paragraph text.
const SEPARATOR = /^\| --- \|/m;

describe('docs tables', () => {
  it('are JSX, so a pipe table is not left as text', () => {
    const hits = pages(APP)
      .filter((path) => SEPARATOR.test(readFileSync(path, 'utf8')))
      .map((path) => relative(APP, path).split(sep).join('/'));
    expect(hits).toEqual([]);
  });
});
