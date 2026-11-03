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
    expect(api['type CardProps extends DOMAttributes<HTMLDivElement>']).toBe('except children');
    expect(Object.keys(api).some((path) => path.includes('onClick'))).toBe(false);
  });

  it('reports a newly omitted DOM prop as narrowed', async () => {
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
      {
        kind: 'narrowed',
        entry: 'lib',
        path: 'type FieldProps extends InputHTMLAttributes<HTMLInputElement>',
        was: 'except size',
        now: 'except onChange, size (as FieldProps extends InputHTMLAttributes)',
      },
    ]);
  });

  it('names the element an inherited interface was given, so a ref or handler for another element shows', async () => {
    const span = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type BadgeProps = ComponentPropsWithRef<'span'>;
    `);
    const div = await report(`
      import type { ComponentPropsWithRef } from 'react';
      export type BadgeProps = ComponentPropsWithRef<'div'>;
    `);
    expect(span['type BadgeProps extends RefAttributes<HTMLSpanElement>']).toBe('all');
    const breaks = apiBreaks({ version: 1, entries: { lib: span } }, { version: 1, entries: { lib: div } });
    expect(breaks.map((item) => [item.kind, item.path])).toEqual([
      ['changed', 'type BadgeProps extends DOMAttributes<HTMLSpanElement>'],
      ['changed', 'type BadgeProps extends RefAttributes<HTMLSpanElement>'],
    ]);
  });

  it('leaves out the names of callback and type parameters, and the order of a constraint', async () => {
    const before = await report(`
      export type SheetProps<T extends string | number> = { value: T; onSnapChange?: (snap: T) => void };
      export function pick<K>(items: K[]): K { return items[0]!; }
    `);
    const after = await report(`
      export type SheetProps<Item extends number | string> = { value: Item; onSnapChange?: (next: Item) => void };
      export function pick<Value>(list: Value[]): Value { return list[0]!; }
    `);
    expect(before['type SheetProps<>']).toBe('<T0 extends number | string>');
    expect(before['type SheetProps.onSnapChange?']).toBe('((arg0: T0) => void) | undefined');
    expect(after).toEqual(before);
  });

  it('numbers the type parameters of a method, drops tuple labels and never renames a string literal', async () => {
    const before = await report(`
      export type Result<K extends string> = { get<P extends object>(props?: P): P; pair(): [value: K, set: (next: K) => void]; hotkey?: 'K' | 'A' };
    `);
    const after = await report(`
      export type Result<Key extends string> = { get<Props extends object>(props?: Props): Props; pair(): [current: Key, update: (value: Key) => void]; hotkey?: 'K' | 'A' };
    `);
    expect(before['type Result.get']).toBe('<T1_0 extends object>(arg0?: T1_0) => T1_0');
    expect(before['type Result.pair']).toBe('() => [T0, (arg0: T0) => void]');
    expect(before['type Result.hotkey?']).toBe("'A' | 'K' | undefined");
    expect(after).toEqual(before);
  });

  it('reads the same whatever order or names the source uses for members, mapped keys and infer', async () => {
    const before = await report(`
      type Base = { id: string };
      export type Pick1<T> = { [K in keyof T]: T[K] };
      export type Item<T> = T extends Array<infer E> ? E : never;
      export type Fn = (<A>(arg: A) => A) | (<B>(arg: B) => string);
      export type Named = ({ 'aria-label': string; role: 'dialog' } | { role?: undefined }) & Base;
      type W = { w?: string }; type X = { x?: string }; type Y = { y?: string; z: 1 | 2 };
      export type Grouped = W & X & Y;
    `);
    const after = await report(`
      type Base = { id: string };
      export type Pick1<T> = { [P in keyof T]: T[P] };
      export type Item<T> = T extends Array<infer U> ? U : never;
      export type Fn = (<B>(arg: B) => string) | (<A>(arg: A) => A);
      export type Named = Base & ({ role?: undefined } | { role: 'dialog'; 'aria-label': string });
      type W = { w?: string }; type X = { x?: string }; type Y = { y?: string; z: 1 | 2 };
      export type Grouped = Y & (X & W);
    `);
    expect(after).toEqual(before);
  });

  it('lists a prop React declares in a type literal and an index signature', async () => {
    const api = await report(`
      import type { PropsWithChildren } from 'react';
      export type BoxProps = PropsWithChildren<{ tone?: string }> & { [key: \`data-\${string}\`]: string | undefined };
    `);
    expect(api['type BoxProps.children?']).toMatch(/ReactNode/);
    expect(api['type BoxProps.[`data-${string}`]']).toBe('string | undefined');
  });

  it('prints a generic mapped type by its declaration, since it has no members to list', async () => {
    const api = await report(`export type Kinds<K extends string = string> = Readonly<Record<K, 'a' | 'b'>>;`);
    expect(api['type Kinds']).toContain("'a' | 'b'");
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
