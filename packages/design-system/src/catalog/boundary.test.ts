import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(path);
    }
  }
  return files;
}

describe('catalog boundary', () => {
  it('does not import react, node:, or packages', async () => {
    const files = await walk(join(import.meta.dirname));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"]react(?:\/|$)/);
      expect(source, file).not.toMatch(/from ['"]node:/);
      expect(source, file).not.toMatch(/from ['"][^./]/);
    }
  });

  it('adapter modules emit templates and never name Jev', async () => {
    const files = await walk(join(import.meta.dirname, 'adapters'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/Jev|toJev|\$state/);
      expect(source, file).not.toMatch(/from ['"]react(?:\/|$)/);
      expect(source, file).not.toMatch(/from ['"]node:/);
      expect(source, file).not.toMatch(/from ['"][^./]/);
    }
  });
});
