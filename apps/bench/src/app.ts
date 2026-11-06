/**
 * Builds the benchmark page against one todae build and serves built pages.
 *
 * `@tounsoo/todae` and its subpaths point at the `dist/` of the given package
 * folder, so the same page measures this checkout or an older ref's build.
 * React always comes from the bench's own install, so both sides run the same
 * React.
 */
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { build, type Alias } from 'vite';

export const BENCH_DIR = resolve(import.meta.dirname, '..');
export const APP_DIR = join(BENCH_DIR, 'app');

type Exports = Record<string, string | { import?: string; default?: string }>;

/** Aliases for every export the package at `todaeDir` declares, longest subpath first. */
export async function todaeAliases(todaeDir: string): Promise<Alias[]> {
  const manifest = JSON.parse(await readFile(join(todaeDir, 'package.json'), 'utf8')) as { exports?: Exports };
  if (!manifest.exports) throw new Error(`${todaeDir}/package.json has no exports`);
  const aliases: Alias[] = [];
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    const file = typeof target === 'string' ? target : (target.import ?? target.default);
    if (!file) continue;
    const name = subpath === '.' ? '@tounsoo/todae' : `@tounsoo/todae/${subpath.replace(/^\.\//, '')}`;
    aliases.push({ find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`), replacement: join(todaeDir, file) });
  }
  return aliases.sort((a, b) => String(b.find).length - String(a.find).length);
}

export async function buildPage(todaeDir: string, outDir: string): Promise<void> {
  await stat(join(todaeDir, 'dist', 'index.js')).catch(() => {
    throw new Error(`${todaeDir} has no dist/index.js. Build it first with pnpm build:ds.`);
  });
  await build({
    root: APP_DIR,
    base: './',
    configFile: false,
    logLevel: 'warn',
    mode: 'production',
    esbuild: { jsx: 'automatic' },
    resolve: { alias: await todaeAliases(todaeDir), dedupe: ['react', 'react-dom'] },
    build: {
      outDir,
      emptyOutDir: true,
      reportCompressedSize: false,
      // One page holds every case, the billing demo's icon sets included.
      chunkSizeWarningLimit: 4096,
      rollupOptions: {
        // An older build may lack a part a case uses. It comes in as undefined,
        // so only that case fails, when it renders.
        shimMissingExports: true,
        onwarn(warning, warn) {
          // The docs demo files start with 'use client', which only Next reads.
          // Rollup then fails to map that warning to a source line, and says so.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR') return;
          warn(warning);
        },
      },
    },
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/** Serves each folder under its own prefix, such as `/before/` and `/after/`. */
export async function serve(roots: Record<string, string>): Promise<{ origin: string; close(): Promise<void> }> {
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const [, prefix = '', ...rest] = url.pathname.split('/');
    const root = roots[prefix];
    const relative = normalize(rest.join('/') || 'index.html');
    if (!root || relative.startsWith('..') || relative.startsWith(sep)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(join(root, relative));
      response.writeHead(200, { 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
