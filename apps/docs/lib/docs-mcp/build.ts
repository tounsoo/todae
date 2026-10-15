import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { buildCompanyTokens, contrastResults, resolveEntries } from '@omsoo.design/todae/tokens-builder';

const SOURCE = 'todae-docs' as const;

export const MAX_FILES = 64;
export const MAX_BYTES = 512 * 1024;
/** Bounds on a resolver, so one call can't ask for an outsized build. */
export const MAX_MODIFIERS = 16;
export const MAX_CONTEXTS = 16;
export const MAX_SOURCES = 128;
export const MAX_COLOR_SCHEMES = 16;
export const MAX_CONTRAST_PAIRS = 64;
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

/**
 * Throws unless every key is a relative `.json` path, no path is a folder of
 * another, the resolver is one of them and the files fit the size limit.
 * Object values are measured as compact JSON.
 */
export function checkFiles(files: Record<string, unknown>, resolver = 'resolver.json'): Map<string, string> {
  const names = Object.keys(files);
  if (names.length > MAX_FILES) throw new Error(`At most ${MAX_FILES} files`);
  if (!names.includes(resolver)) throw new Error(`files must include the resolver, "${resolver}"`);
  const out = new Map<string, string>();
  let bytes = 0;
  for (const name of names) {
    if (!FILE_RE.test(name)) {
      throw new Error(`Invalid file path "${name}": use a relative path to a .json file, such as "appearance/light.json"`);
    }
    const folder = names.find((other) => other.startsWith(`${name}/`));
    if (folder) throw new Error(`"${name}" can't be both a file and the folder of "${folder}"`);
    const value = files[name];
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text === undefined) throw new Error(`File "${name}" has no contents`);
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_BYTES) throw new Error(`Files may total at most ${MAX_BYTES / 1024} KB`);
    out.set(name, text);
  }
  return out;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function countRefs(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countRefs(item), 0);
  const row = record(value);
  return (typeof row.$ref === 'string' ? 1 : 0) + Object.values(row).reduce<number>((sum, child) => sum + countRefs(child), 0);
}

/**
 * Throws when a resolver asks for more work than one call allows. Contrast
 * pairs are measured once per combination of every color-scheme modifier's
 * contexts, so their product is capped. A resolver that isn't valid JSON is
 * left to the build to report.
 */
export function checkResolver(text: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  const resolver = record(parsed);
  const modifiers = Object.entries(record(resolver.modifiers));
  if (modifiers.length > MAX_MODIFIERS) throw new Error(`A resolver may declare at most ${MAX_MODIFIERS} modifiers`);
  let schemes = 1;
  let pairs = 0;
  const entries = [...Object.values(record(resolver.sets)), ...modifiers.map(([, modifier]) => modifier)];
  for (const entry of entries) {
    const contrast = record(record(record(entry).$extensions)['dev.todae']).contrast;
    if (Array.isArray(contrast)) pairs += contrast.length;
  }
  if (pairs > MAX_CONTRAST_PAIRS) throw new Error(`A resolver may declare at most ${MAX_CONTRAST_PAIRS} contrast pairs`);
  for (const [name, modifier] of modifiers) {
    const contexts = Object.keys(record(record(modifier).contexts)).length;
    if (contexts > MAX_CONTEXTS) throw new Error(`Modifier "${name}" may have at most ${MAX_CONTEXTS} contexts`);
    if (record(record(record(modifier).$extensions)['dev.todae']).colorScheme === true) {
      // Todae's appearance already has light and dark, which a company's contexts join.
      schemes *= contexts + (name === 'appearance' ? 2 : 0);
    }
  }
  if (schemes > MAX_COLOR_SCHEMES) {
    throw new Error(`Color-scheme modifiers may combine into at most ${MAX_COLOR_SCHEMES} combinations of contexts`);
  }
  if (countRefs(resolver) > MAX_SOURCES) throw new Error(`A resolver may hold at most ${MAX_SOURCES} $refs`);
}

/** Drops the temporary folder from a message, which may name files by absolute or cwd-relative path. */
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
 * path relative to the folder they sit in, with `resolver` naming the
 * resolver among them. The files go to a temporary folder that is removed
 * when the build ends.
 */
export async function buildTokenFiles(
  files: Record<string, unknown>,
  { resolver = 'resolver.json', base = todaeTokensDir() }: { resolver?: string; base?: string } = {},
): Promise<BuildResult> {
  const contents = checkFiles(files, resolver);
  checkResolver(contents.get(resolver) ?? '');
  const root = await mkdtemp(join(tmpdir(), 'todae-mcp-'));
  try {
    for (const [name, text] of contents) {
      const file = join(root, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    const result = await buildCompanyTokens({ resolver: join(root, resolver), base });
    return {
      ok: true,
      css: result.css,
      overrideTypes: result.overrideTypes,
      tokenCount: new Set(result.companyTokens.map((token) => token.path)).size,
      contrast: result.contrast.map(({ fg, bg, min, where, lc }) => ({ fg, bg, min, where, lc: Math.round(lc * 10) / 10 })),
      source: SOURCE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: scrub(message, root), source: SOURCE };
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
