import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(join(process.cwd(), '../../packages/design-system/package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};
const tsconfig = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8')) as {
  compilerOptions: { paths: Record<string, string[]> };
};

describe('docs resolves the design system from source', () => {
  // Without a mapping, a subpath falls through to dist, which a fresh clone
  // lacks and whose class names the docs' source CSS does not define.
  it('maps every module entry of @omsoo/todae to its source file', () => {
    const modules = Object.entries(pkg.exports)
      .filter(([key, value]) => typeof value === 'object' && value !== null && 'import' in value && key !== './tokens-builder')
      .map(([key]) => (key === '.' ? '@omsoo/todae' : `@omsoo/todae/${key.slice(2)}`));
    expect(modules).toEqual(expect.arrayContaining(['@omsoo/todae', '@omsoo/todae/stack', '@omsoo/todae/text']));
    for (const name of modules) {
      const target = tsconfig.compilerOptions.paths[name]?.[0];
      expect(target, name).toMatch(/^\.\.\/\.\.\/packages\/design-system\/src\/.+\.ts$/);
    }
  });
});
