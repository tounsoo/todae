import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeBlocks } from '../../lib/mdxAst';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

function cssFences(path: string): string[] {
  return codeBlocks(read(path)).code.flatMap((source) => {
    const [fence = '', ...lines] = source.split('\n');
    return fence.replace(/^`+/, '').trim() === 'css' ? [lines.slice(0, -1).join('\n')] : [];
  });
}

// The first example shows this stylesheet after its code, so the page quotes none of it by hand,
// and the size rules its prose names are in it.
const STACK = read('examples/recipes/avatar-group/AvatarGroup.module.css');

describe('avatar group recipe css', () => {
  it.each([
    'app/(en)/recipes/avatar-group/page.mdx',
    'app/ko/recipes/avatar-group/page.mdx',
  ])('quotes, on %s, no CSS beside the stylesheet the example shows', (page) => {
    expect(cssFences(page)).toEqual([]);
    for (const name of read(page).match(/`\.(small|large)`/g) ?? []) expect(STACK).toContain(`${name.slice(1, -1)} {`);
  });
});
