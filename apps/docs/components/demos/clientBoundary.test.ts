import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The main @tounsoo/todae entry is a client module: a server page that renders
// its compound parts gets undefined and fails to prerender. Examples that import it
// must be client modules too; server-safe parts come from their own entries.
describe('docs examples', () => {
  const examples = join(import.meta.dirname, '../../examples');
  const demos = readdirSync(examples, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => join(examples, file));

  it.each(demos)('%s is a client module if it imports the main entry', (file) => {
    const code = readFileSync(file, 'utf8');
    if (/from ['"]@tounsoo\/todae['"]/.test(code)) expect(code.startsWith("'use client';")).toBe(true);
  });
});
