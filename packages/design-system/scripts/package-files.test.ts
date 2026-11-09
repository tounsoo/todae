// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkgDir = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(pkgDir, file), 'utf8');

/** Every package file a published script imports, following relative imports. */
function closure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, spec] of read(file).matchAll(/from\s+'(\.[^']+)'/g)) {
    closure(relative(pkgDir, join(pkgDir, dirname(file), spec!)), seen);
  }
  return seen;
}

describe('published files', () => {
  it('counts every script the published bin and tokens-builder run as shipping', () => {
    const { include } = JSON.parse(read('tsconfig.scripts.json')) as { include: string[] };
    const shipped = include.flatMap((entry) => [...closure(entry)]);
    const config = JSON.parse(readFileSync(join(pkgDir, '../../.changeset/config.json'), 'utf8')) as { changedFilePatterns: string[] };
    const notShipping = config.changedFilePatterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    for (const file of shipped) expect(notShipping, file).not.toContain(file);
    expect(shipped).toContain('scripts/tokens/cli.ts');
  });

  it('leaves the repo-only token files out of the tarball and out of the changeset check', () => {
    const { files } = JSON.parse(read('package.json')) as { files: string[] };
    const config = JSON.parse(readFileSync(join(pkgDir, '../../.changeset/config.json'), 'utf8')) as { changedFilePatterns: string[] };
    for (const file of files.filter((entry) => entry.startsWith('!'))) expect(config.changedFilePatterns).toContain(file);
  });
});
