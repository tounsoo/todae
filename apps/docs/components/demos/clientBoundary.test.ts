import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The main @omsoo/todae entry is a client module: a server page that renders
// its compound parts gets undefined and fails to prerender. Demos that import it
// must be client modules too; server-safe parts come from their own entries.
describe('docs demos', () => {
  const dir = import.meta.dirname;
  const demos = readdirSync(dir).filter((file) => file.endsWith('Demo.tsx'));

  it.each(demos)('%s is a client module if it imports the main entry', (file) => {
    const code = readFileSync(join(dir, file), 'utf8');
    if (/from ['"]@omsoo\/todae['"]/.test(code)) expect(code.startsWith("'use client';")).toBe(true);
  });
});
