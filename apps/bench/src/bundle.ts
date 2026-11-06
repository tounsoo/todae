/**
 * What an app pays in bytes for each import: the main entry bundled with
 * esbuild, minified, React left out, in production mode, then gzipped. These
 * are exact counts, so they compare against any record.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { metric, type CaseResult } from './record.ts';

/** The imports measured, one bundle each. */
export const BUNDLE_IMPORTS = [
  'Badge',
  'Button',
  'Card',
  'Checkbox',
  'Coachmark',
  'Dialog',
  'Field',
  'Menu',
  'Popover',
  'ScrollArea',
  'Switch',
  'Table',
  'Tabs',
  'Text',
  'ThemeProvider',
  'Toast',
  'Tooltip',
] as const;

const gzip = (bytes: Uint8Array) => gzipSync(bytes, { level: 9 }).length;

async function size(entry: string, code: string): Promise<{ min: number; gzip: number }> {
  const result = await build({
    stdin: { contents: code, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
    alias: { '@tounsoo/todae': entry },
    logLevel: 'silent',
  });
  const file = result.outputFiles[0];
  if (!file) throw new Error('esbuild wrote no output');
  return { min: file.contents.length, gzip: gzip(file.contents) };
}

function sizeCase(id: string, title: string, bytes: { min: number; gzip: number }): CaseResult {
  return {
    id,
    title,
    metrics: {
      minBytes: metric('count', 'bytes', [bytes.min]),
      gzipBytes: metric('count', 'bytes', [bytes.gzip]),
    },
  };
}

function message(error: unknown): string {
  const first = (error as { errors?: { text?: string }[] }).errors?.[0]?.text;
  const missing = first?.match(/No matching export .* for import "([^"]+)"/);
  if (missing) return `${missing[1]} is not exported by this build`;
  return first ?? (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'failed';
}

/** Measures each import against the built package in `todaeDir` (a folder with `dist/`). */
export async function measureBundles(todaeDir: string, imports: readonly string[] = BUNDLE_IMPORTS): Promise<CaseResult[]> {
  const entry = join(todaeDir, 'dist', 'index.js');
  const results: CaseResult[] = [];
  results.push(sizeCase('bundle/everything', 'Every export', await size(entry, `import * as T from '@tounsoo/todae'; console.log(T);`)));
  for (const name of imports) {
    try {
      results.push(sizeCase(`bundle/${name}`, `import { ${name} }`, await size(entry, `import { ${name} } from '@tounsoo/todae'; console.log(${name});`)));
    } catch (error) {
      results.push({ id: `bundle/${name}`, title: `import { ${name} }`, metrics: {}, error: message(error) });
    }
  }
  const css = await readFile(join(todaeDir, 'dist', 'todae.css'));
  results.push(sizeCase('bundle/todae.css', 'todae.css', { min: css.length, gzip: gzip(css) }));
  return results;
}
