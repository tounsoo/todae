import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED = new RegExp(['scrollbar-(width|color)', 'scrollbar(Width|Color)', '::-' + 'webkit-scrollbar'].join('|'));
const EXT = new Set(['.css', '.ts', '.tsx', '.mdx']);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') return [];
      return files(path);
    }
    const dot = entry.name.lastIndexOf('.');
    return EXT.has(entry.name.slice(dot)) ? [path] : [];
  });
}

describe('scrollbar styling', () => {
  it('leaves scrollbars native', () => {
    const hits = [join(import.meta.dirname, '..'), join(import.meta.dirname, '../../../../apps/docs')]
      .flatMap(files)
      .filter((file) => BANNED.test(readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });
});
