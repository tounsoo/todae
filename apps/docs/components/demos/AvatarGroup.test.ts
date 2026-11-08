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

// The examples show this stylesheet after their code; a rule quoted in prose must be one of its rules.
const STACK = read('examples/recipes/avatar-group/AvatarGroup.module.css').trimEnd();

describe('avatar group recipe css', () => {
  it.each([
    'app/(en)/recipes/avatar-group/page.mdx',
    'app/ko/recipes/avatar-group/page.mdx',
  ])('quotes, on %s, only rules the stylesheet has', (page) => {
    const fences = cssFences(page);
    expect(fences).toHaveLength(1);
    for (const fence of fences) for (const rule of fence.split('\n\n')) expect(STACK.split('\n\n')).toContain(rule);
  });
});
