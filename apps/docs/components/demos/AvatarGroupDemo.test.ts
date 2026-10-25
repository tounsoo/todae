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

const MODULE = read('components/demos/AvatarGroupDemo.module.css');

describe('avatar group recipe css', () => {
  it.each(['app/(en)/recipes/avatar-group/page.mdx', 'app/ko/recipes/avatar-group/page.mdx'])(
    'shows, on %s, the stylesheet the demo imports',
    (page) => {
      expect(cssFences(page).join('\n\n') + '\n').toBe(MODULE);
    },
  );

  it.each(['app/(en)/avatar/page.mdx', 'app/ko/avatar/page.mdx'])('shows, on %s, a rule the stylesheet has', (page) => {
    const fences = cssFences(page);
    expect(fences).toHaveLength(1);
    expect(MODULE.split('\n\n')).toContain(fences[0]);
  });
});
