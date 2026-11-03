import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { apiSnapshot, apiBreaks } from './compare.ts';
import { apiReport } from './report.ts';

const nodeModules = join(import.meta.dirname, '..', '..', 'node_modules');
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(files: Record<string, string>, exportsField?: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'typescript-api-'));
  roots.push(root);
  const all: Record<string, string> = {
    'package.json': JSON.stringify({
      name: '@scope/lib',
      version: '0.1.0',
      exports: exportsField ?? { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    }),
    'tsconfig.build.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        declaration: true,
        emitDeclarationOnly: true,
        rootDir: 'src',
        outDir: 'dist',
        typeRoots: [join(nodeModules, '@types')],
        types: ['react'],
        paths: { react: [join(nodeModules, '@types', 'react')], 'react/*': [join(nodeModules, '@types', 'react', '*')] },
      },
      include: ['src'],
    }),
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

async function report(source: string): Promise<Record<string, string>> {
  const root = await fixture({ 'src/index.ts': source });
  return apiSnapshot(apiReport(root)).entries['@scope/lib'] ?? {};
}

describe('apiReport', () => {
  it('prints a component by its parameter types, not its parameter names', async () => {
    const before = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type ButtonProps = ComponentPropsWithRef<'button'>;
      export function Button({ className, ...props }: ButtonProps) { return null; }
    `);
    const after = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type ButtonProps = ComponentPropsWithRef<'button'>;
      export function Button(props: ButtonProps) { return null; }
    `);
    expect(before.Button).toBe('(arg0: ButtonProps) => null');
    expect(after).toEqual(before);
  });

  it('lists a compound component part by part', async () => {
    const api = await report(`
      function Root(props: { open?: boolean }) { return null; }
      function Title(props: { id: string }) { return null; }
      export const Dialog = { Root, Title };
    `);
    expect(api.Dialog).toBe('object');
    expect(api['Dialog.Root']).toBe('(arg0: { open?: boolean; }) => null');
    expect(api['Dialog.Title']).toBe('(arg0: { id: string; }) => null');
  });

  it('lists own props one by one and inherited DOM props by what they leave out', async () => {
    const api = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type CardProps = Omit<ComponentPropsWithRef<'div'>, 'title' | 'children'> & { tone?: 'info' | 'critical'; title: string };
    `);
    expect(api['type CardProps']).toBe('object');
    expect(api['type CardProps.tone?']).toBe("'critical' | 'info' | undefined");
    expect(api['type CardProps.title']).toBe('string');
    expect(api['type CardProps extends HTMLAttributes']).toBe('except title');
    expect(api['type CardProps extends DOMAttributes']).toBe('except children');
    expect(Object.keys(api).some((path) => path.includes('onClick'))).toBe(false);
  });

  it('reports a newly omitted DOM prop as a change', async () => {
    const before = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type FieldProps = Omit<ComponentPropsWithRef<'input'>, 'size'>;
    `);
    const after = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type FieldProps = Omit<ComponentPropsWithRef<'input'>, 'size' | 'onChange'>;
    `);
    const breaks = apiBreaks({ version: 1, entries: { lib: before } }, { version: 1, entries: { lib: after } });
    expect(breaks).toEqual([
      { kind: 'changed', entry: 'lib', path: 'type FieldProps extends InputHTMLAttributes', was: 'except size', now: 'except onChange, size' },
    ]);
  });

  it('prints union members in the same order whatever order the source uses', async () => {
    const first = await report(`export type Size = 'sm' | 'md' | 'lg'; export type Gap = 'lg' | 'sm';`);
    const second = await report(`export type Gap = 'sm' | 'lg'; export type Size = 'lg' | 'md' | 'sm';`);
    expect(first['type Size']).toBe("'lg' | 'md' | 'sm'");
    expect(second).toEqual(first);
  });

  it('lists a long union of literals one member per path, so dropping one is a removal', async () => {
    const keys = Array.from({ length: 14 }, (_, index) => `'key-${String(index).padStart(2, '0')}'`);
    const before = await report(`export type Key = ${keys.join(' | ')};`);
    const after = await report(`export type Key = ${keys.slice(1).join(' | ')};`);
    expect(before['type Key']).toBe('union');
    expect(before["type Key | 'key-00'"]).toBe('member');
    const breaks = apiBreaks({ version: 1, entries: { lib: before } }, { version: 1, entries: { lib: after } });
    expect(breaks).toEqual([{ kind: 'removed', entry: 'lib', path: "type Key | 'key-00'", was: 'member' }]);
  });

  it('prints a type the API names but does not export as an internal type', async () => {
    const api = await report(`
      type ActionProps = { variant?: 'primary' | 'secondary'; onPress(): void };
      export function Close(props: ActionProps) { return null; }
    `);
    expect(api.Close).toBe('(arg0: ActionProps) => null');
    expect(api['internal ActionProps']).toBe('object');
    expect(api['internal ActionProps.variant?']).toBe("'primary' | 'secondary' | undefined");
    expect(api['internal ActionProps.onPress']).toBe('() => void');
  });

  it('names a unique symbol key the same way on every run', async () => {
    const api = await report(`
      declare const brand: unique symbol;
      export type Branded = { readonly [brand]: true; value: string };
    `);
    expect(api['type Branded.[brand]']).toBe('readonly true');
  });

  it('reports every typed entry point under its import path', async () => {
    const root = await fixture(
      { 'src/index.ts': 'export const a = 1;', 'src/server/stack.ts': 'export const b: string = "";' },
      {
        '.': { types: './dist/index.d.ts' },
        './stack': { types: './dist/server/stack.d.ts' },
        './todae.css': './dist/todae.css',
      },
    );
    expect(apiSnapshot(apiReport(root)).entries).toEqual({
      '@scope/lib': { a: '1' },
      '@scope/lib/stack': { b: 'string' },
    });
  });

  it('fails when an entry point has no source file', async () => {
    const root = await fixture({ 'src/index.ts': 'export const a = 1;' }, {
      '.': { types: './dist/index.d.ts' },
      './missing': { types: './dist/missing.d.ts' },
    });
    expect(() => apiReport(root)).toThrow('No source file declares the types of "./missing".');
  });
});
