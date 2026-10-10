import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LICENSE } from './license';

const root = join(process.cwd(), '../..');
const text = readFileSync(join(root, 'LICENSE'), 'utf8');
const packageLicense = (path: string) => (JSON.parse(readFileSync(join(root, path), 'utf8')) as { license?: string }).license;

describe('the footer license', () => {
  it('matches the LICENSE file', () => {
    expect(text.split('\n')[0]).toBe(`${LICENSE.id} License`);
    expect(text).toContain(`Copyright (c) ${LICENSE.year} ${LICENSE.holder}\n`);
  });

  it('matches every package.json', () => {
    for (const path of ['package.json', 'packages/design-system/package.json', 'apps/docs/package.json']) {
      expect(packageLicense(path), path).toBe(LICENSE.id);
    }
  });
});
