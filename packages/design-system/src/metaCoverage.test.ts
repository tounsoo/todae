import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as api from './index.js';
import type { ComponentMeta } from './meta.js';

// Every *.meta.ts in the package, which `pnpm schema` turns into schema/components.json.
const files = readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.meta.ts'));
const metas = await Promise.all(files.map((file) => import(join(import.meta.dirname, file)) as Promise<{ meta: ComponentMeta }>));
const named = new Set(metas.map((mod) => mod.meta.name));

// A namespace such as Chip is PascalCase; a constant such as DEFAULT_STRINGS is upper snake case.
const isNamespace = (name: string, value: unknown) =>
  /^[A-Z][a-z]/.test(name) && typeof value === 'object' && value !== null && !Array.isArray(value);

describe('meta coverage', () => {
  it('has a meta for every function and namespace part the package exports', () => {
    const missing: string[] = [];
    for (const [name, value] of Object.entries(api)) {
      if (isNamespace(name, value)) {
        for (const part of Object.keys(value as object)) if (!named.has(`${name}.${part}`)) missing.push(`${name}.${part}`);
      } else if (typeof value === 'function' && !named.has(name)) {
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
});
