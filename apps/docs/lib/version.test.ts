import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASE } from './version';

const root = join(process.cwd(), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'packages/design-system/package.json'), 'utf8')) as { version: string };

describe('the footer release line', () => {
  it('shows the version in the package.json of @tounsoo/todae', () => {
    expect(RELEASE.version).toBe(pkg.version);
    expect(RELEASE.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('links to the changelog the release workflow writes', () => {
    const prefix = 'https://github.com/tounsoo/todae/blob/main/';
    expect(RELEASE.changelogHref.startsWith(prefix)).toBe(true);
    const path = RELEASE.changelogHref.slice(prefix.length);
    expect(existsSync(join(root, path)), path).toBe(true);
    expect(readFileSync(join(root, path), 'utf8')).toContain(`## ${RELEASE.version}\n`);
  });
});
