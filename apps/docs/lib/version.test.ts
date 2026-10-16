import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASE } from './version';

const root = join(process.cwd(), '../..');

describe('the footer release line', () => {
  it('links to the changelog the release workflow writes, which has an entry for the version', () => {
    const prefix = 'https://github.com/tounsoo/todae/blob/main/';
    expect(RELEASE.changelogHref.startsWith(prefix)).toBe(true);
    const path = RELEASE.changelogHref.slice(prefix.length);
    expect(existsSync(join(root, path)), path).toBe(true);
    // Normalized, so a checkout with CRLF line endings reads the same.
    const changelog = readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
    expect(changelog).toContain(`\n## ${RELEASE.version}\n`);
  });
});
