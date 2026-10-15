import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import {
  buildCompanyTokens,
  contrastResults,
  loadResolver,
  mergeEntries,
  resolveEntries,
} from '@omsoo.design/todae/tokens-builder';

const SOURCE = 'todae-docs' as const;

export const MAX_FILES = 64;
export const MAX_BYTES = 512 * 1024;
const FILE_RE = /^(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\.json$/i;

/**
 * Todae's own `tokens/` directory. The docs app's dependency link resolves in
 * development and tests; the workspace path is the one a deployment traces.
 */
export function todaeTokensDir(cwd = process.cwd()): string {
  const candidates = [
    join(cwd, 'node_modules', '@omsoo.design', 'todae', 'tokens'),
    join(cwd, '..', '..', 'packages', 'design-system', 'tokens'),
  ];
  const found = candidates.find((dir) => existsSync(join(dir, 'resolver.json')));
  if (!found) throw new Error("Could not find Todae's tokens/resolver.json");
  return found;
}

/** Throws unless every key is a relative `.json` path that stays in its folder, and `resolver.json` is one of them. */
export function checkFiles(files: Record<string, unknown>): Map<string, string> {
  const names = Object.keys(files);
  if (names.length > MAX_FILES) throw new Error(`At most ${MAX_FILES} files`);
  if (!names.includes('resolver.json')) throw new Error('files must include "resolver.json" at the top level');
  const out = new Map<string, string>();
  let bytes = 0;
  for (const name of names) {
    if (!FILE_RE.test(name) || name.split('/').some((segment) => segment === '.' || segment === '..')) {
      throw new Error(`Invalid file path "${name}": use a relative path to a .json file, such as "appearance/light.json"`);
    }
    const value = files[name];
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (text === undefined) throw new Error(`File "${name}" has no contents`);
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_BYTES) throw new Error(`Files may total at most ${MAX_BYTES / 1024} KB`);
    out.set(name, text);
  }
  return out;
}

/** Drops the temporary folder from a build message, which names files by absolute or cwd-relative path. */
function scrub(message: string, root: string): string {
  let out = message;
  for (const prefix of [relative(process.cwd(), root), root]) {
    out = out.replaceAll(`${prefix}/`, '').replaceAll(prefix, '.');
  }
  return out;
}

export type BuildResult =
  | {
      ok: true;
      css: string;
      overrideTypes: string;
      tokenCount: number;
      contrast: { fg: string; bg: string; min: number; where: string; lc: number }[];
      source: typeof SOURCE;
    }
  | { ok: false; error: string; source: typeof SOURCE };

/**
 * Runs `todae-tokens build` on a company's token files, given as contents by
 * path relative to the resolver. Nothing is kept: the files go to a temporary
 * folder that is removed when the build ends.
 */
export async function buildTokenFiles(files: Record<string, unknown>, base = todaeTokensDir()): Promise<BuildResult> {
  const contents = checkFiles(files);
  const root = await mkdtemp(join(tmpdir(), 'todae-mcp-'));
  try {
    for (const [name, text] of contents) {
      const file = join(root, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    const resolver = join(root, 'resolver.json');
    try {
      const result = await buildCompanyTokens({ resolver, base });
      const upstream = await resolveEntries(base);
      const { merged, company } = mergeEntries(upstream, await loadResolver(resolver, upstream));
      const ownPaths = new Set(company.flatMap((entry) => (entry.kind === 'set' ? entry.tokens : [...entry.contexts.values()].flat()).map((token) => token.path)));
      return {
        ok: true,
        css: result.css,
        overrideTypes: result.overrideTypes,
        tokenCount: ownPaths.size,
        contrast: contrastResults(merged).map(({ fg, bg, min, where, lc }) => ({ fg, bg, min, where, lc: Math.round(lc * 10) / 10 })),
        source: SOURCE,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: scrub(message, root), source: SOURCE };
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Todae's own contrast pairs, measured on its base theme. */
export async function baseContrast(base = todaeTokensDir()) {
  const pairs = contrastResults(await resolveEntries(base)).map(({ fg, bg, min, where, lc }) => ({
    fg,
    bg,
    min,
    where,
    lc: Math.round(lc * 10) / 10,
  }));
  return { pairs, count: pairs.length, source: SOURCE };
}
