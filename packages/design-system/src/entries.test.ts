// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Builds the package fresh into a temp dir, so this never reads a stale dist.
const dist = mkdtempSync(join(tmpdir(), 'todae-dist-'));
beforeAll(async () => {
  // Vitest runs with NODE_ENV=test, which would make Vite emit the dev JSX runtime.
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await build({
      configFile: join(import.meta.dirname, '../vite.config.ts'),
      logLevel: 'silent',
      mode: 'production',
      build: { outDir: dist, emptyOutDir: true },
    });
  } finally {
    process.env.NODE_ENV = env;
  }
}, 60_000);
afterAll(() => rmSync(dist, { recursive: true, force: true }));
const read = (file: string) => readFileSync(join(dist, file), 'utf8');
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as {
  exports: Record<string, { import: string; types: string } | string>;
};

/** Every file a built module pulls in, following relative imports. */
function closure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const code = read(file);
  for (const [, spec] of code.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    closure(join(file, '..', spec!).replace(/^\//, ''), seen);
  }
  return seen;
}

describe('package entries', () => {
  it('marks the main entry as a client boundary', () => {
    expect(read('index.js').startsWith('"use client";')).toBe(true);
  });

  it.each(['stack', 'text', 'label', 'badge', 'card', 'breadcrumbs', 'grid', 'pagination'])('ships %s as a server-safe entry', (name) => {
    const entry = pkg.exports[`./${name}`];
    expect(entry).toEqual({ types: `./dist/server/${name}.d.ts`, import: `./dist/${name}.js` });
    for (const file of closure(`${name}.js`)) {
      const code = read(file);
      expect(code, file).not.toMatch(/use client/);
      expect(code, file).not.toMatch(/\buse[A-Z]\w*\b|createContext/);
      expect(code, file).not.toMatch(/\.css["']/);
      for (const [, spec] of code.matchAll(/from\s+["']([^."'][^"']*)["']/g)) expect(spec, file).toBe('react/jsx-runtime');
    }
    expect(readFileSync(join(import.meta.dirname, '../tsconfig.build.json'), 'utf8')).toContain('"include": ["src"]');
  });

  it('declares the todae layer order before any layer is used', () => {
    // A layer's place is fixed where it is first named, so a component rule
    // ahead of this statement would put todae.components below todae.base.
    const css = read('todae.css');
    const order = '@layer todae.reset,todae.base,todae.components;';
    expect(css.startsWith(order)).toBe(true);
    for (const statement of css.match(/@layer [^;{]*;/g)!) expect(statement).toBe(order);
  });

  it('exports the stylesheet by name and by its dist path', () => {
    // postcss-import ignores exports and reads dist/todae.css by path, so
    // that path is exported too for resolvers that enforce exports.
    expect(pkg.exports['./todae.css']).toBe('./dist/todae.css');
    expect(pkg.exports['./dist/todae.css']).toBe('./dist/todae.css');
  });
});
