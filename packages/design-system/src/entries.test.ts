// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build as esbuild } from 'esbuild';
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
  exports: Record<string, { types: string; default: string } | string>;
};

// Every file in src/server is a server-safe entry; vite.config.ts builds each one.
const serverEntries = readdirSync(join(import.meta.dirname, 'server'))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => file.slice(0, -'.ts'.length))
  .sort();
// Exports that are not server entries.
const otherExports = ['.', './todae.css', './dist/todae.css', './schema/components.json', './tokens.json', './tokens-builder', './package.json'];
const docsPathMap = (
  JSON.parse(readFileSync(join(import.meta.dirname, '../../../apps/docs/tsconfig.json'), 'utf8')) as { compilerOptions: { paths: Record<string, string[]> } }
).compilerOptions.paths;
const docsPaths = Object.keys(docsPathMap);
const docsOther = ['@tounsoo/todae', '@tounsoo/todae/todae.css', '@tounsoo/todae/schema/components.json', '@tounsoo/todae/tokens.json', '@tounsoo/todae/tokens-builder'];

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

  it.each(serverEntries)('ships %s as a server-safe entry', (name) => {
    const entry = pkg.exports[`./${name}`];
    expect(entry, `package.json exports["./${name}"] for src/server/${name}.ts`).toEqual({ types: `./dist/server/${name}.d.ts`, default: `./dist/${name}.js` });
    for (const file of closure(`${name}.js`)) {
      const code = read(file);
      expect(code, file).not.toMatch(/use client/);
      expect(code, file).not.toMatch(/\buse[A-Z]\w*\b|createContext/);
      expect(code, file).not.toMatch(/\.css["']/);
      for (const [, spec] of code.matchAll(/from\s+["']([^."'][^"']*)["']/g)) expect(spec, file).toBe('react/jsx-runtime');
    }
    expect(readFileSync(join(import.meta.dirname, '../tsconfig.build.json'), 'utf8')).toContain('"include": ["src"]');
  });

  it('keeps only .ts files in src/server, which the build and these tests read', () => {
    const other = readdirSync(join(import.meta.dirname, 'server')).filter((file) => !file.endsWith('.ts'));
    expect(other, 'Name each server entry src/server/<name>.ts, or move these files out of src/server').toEqual([]);
  });

  it('lists every src/server file in package.json exports, and nothing else', () => {
    const exported = Object.keys(pkg.exports).filter((key) => !otherExports.includes(key)).map((key) => key.slice(2));
    const missing = serverEntries.filter((name) => !exported.includes(name));
    const extra = exported.filter((name) => !serverEntries.includes(name));
    expect(
      { missing, extra },
      'packages/design-system/package.json exports must list each src/server/<name>.ts as "./<name>": ' +
        '{ "types": "./dist/server/<name>.d.ts", "default": "./dist/<name>.js" }. Add the missing names; remove the extra ones, ' +
        'or add a new non-server export to `otherExports` in src/entries.test.ts.',
    ).toEqual({ missing: [], extra: [] });
  });

  it('lists every src/server file in the docs tsconfig paths, and nothing else', () => {
    const listed = docsPaths.filter((key) => !docsOther.includes(key)).map((key) => key.slice('@tounsoo/todae/'.length));
    const missing = serverEntries.filter((name) => !listed.includes(name));
    const extra = listed.filter((name) => !serverEntries.includes(name));
    expect(
      { missing, extra },
      'apps/docs/tsconfig.json compilerOptions.paths must map each src/server/<name>.ts as ' +
        '"@tounsoo/todae/<name>": ["../../packages/design-system/src/server/<name>.ts"]. Add the missing names; remove the extra ones, ' +
        'or add a new non-server path to `docsOther` in src/entries.test.ts.',
    ).toEqual({ missing: [], extra: [] });
    for (const name of serverEntries) {
      const target = docsPathMap[`@tounsoo/todae/${name}`];
      if (target) expect(target, `apps/docs/tsconfig.json path for @tounsoo/todae/${name}`).toEqual([`../../packages/design-system/src/server/${name}.ts`]);
    }
  });

  it('declares the todae layer order before any layer is used', () => {
    // A layer's place is fixed where it is first named, so a component rule
    // ahead of this statement would put todae.components below todae.base.
    const css = read('todae.css');
    const order = '@layer todae.reset,todae.base,todae.components;';
    expect(css.startsWith(order)).toBe(true);
    for (const statement of css.match(/@layer [^;{]*;/g)!) expect(statement).toBe(order);
  });

  it('resolves every entry with the default condition, so require() and import() both work', () => {
    // Node's require() of an ES module matches `require` or `default`, never `import`.
    for (const [key, entry] of Object.entries(pkg.exports)) {
      if (typeof entry === 'string') continue;
      expect(Object.keys(entry), key).toEqual(['types', 'default']);
    }
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });

  it('exports the stylesheet by name and by its dist path', () => {
    // postcss-import ignores exports and reads dist/todae.css by path, so
    // that path is exported too for resolvers that enforce exports.
    expect(pkg.exports['./todae.css']).toBe('./dist/todae.css');
    expect(pkg.exports['./dist/todae.css']).toBe('./dist/todae.css');
  });
});

describe('tree shaking', () => {
  // esbuild drops less than Rollup, so code it can drop, every bundler can. The temp dist has no
  // package.json, so these bundles ignore `sideEffects` and test the code itself.
  const bundle = async (contents: string) => {
    const result = await esbuild({
      stdin: { contents, resolveDir: dist },
      bundle: true,
      minify: true,
      write: false,
      format: 'esm',
      external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
      logLevel: 'silent',
    });
    return result.outputFiles[0]!.text;
  };

  it('runs no code when nothing is imported from the main entry', async () => {
    const code = await bundle(`import './index.js';`);
    // Only the imports of React are left.
    expect(code.replace(/import\s*(\{[^}]*\}\s*from\s*)?["'][^"']+["'];?/g, '').trim()).toBe('');
  });

  it('leaves out components that are not imported', async () => {
    expect(await bundle(`export { Dialog } from './index.js';`)).toContain('showModal');
    expect(await bundle(`export { Button } from './index.js';`)).not.toContain('showModal');
  });

  it('marks only stylesheets as having side effects', () => {
    expect((pkg as { sideEffects?: unknown }).sideEffects).toEqual(['*.css']);
  });
});
