import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Reads the built package, so run `pnpm build` first (CI builds before testing).
const dist = join(import.meta.dirname, '../dist');
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

  it.each(['stack', 'text', 'label'])('ships %s as a server-safe entry', (name) => {
    const entry = pkg.exports[`./${name}`];
    expect(entry).toEqual({ types: `./dist/server/${name}.d.ts`, import: `./dist/${name}.js` });
    for (const file of closure(`${name}.js`)) {
      const code = read(file);
      expect(code, file).not.toMatch(/use client/);
      expect(code, file).not.toMatch(/\buse[A-Z]\w*\b|createContext/);
      expect(code, file).not.toMatch(/\.css["']/);
      for (const [, spec] of code.matchAll(/from\s+["']([^."'][^"']*)["']/g)) expect(spec, file).toBe('react/jsx-runtime');
    }
    expect(readdirSync(join(dist, 'server'))).toContain(`${name}.d.ts`);
  });
});
