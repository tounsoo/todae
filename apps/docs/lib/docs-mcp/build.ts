import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { contrastResults, resolveEntries } from '@tounsoo/todae/tokens-builder';

const SOURCE = 'todae-docs' as const;

export const MAX_FILES = 64;
export const MAX_BYTES = 512 * 1024;
/** A build that runs longer is stopped. */
export const BUILD_TIMEOUT_MS = 10_000;
/** Theme CSS or override types larger than this are not returned. */
export const MAX_CSS_BYTES = 1024 * 1024;
const BUILD_MEMORY_MB = 256;
/** How much of a failed build's error output is kept. */
export const MAX_ERROR_BYTES = 64 * 1024;
/** Builds one server instance runs at once; a call past this is refused, not queued. */
export const MAX_CONCURRENT_BUILDS = 2;
let running = 0;
const FILE_RE = /^(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\.json$/i;

/** A file in the `@tounsoo/todae` package: through the docs app's dependency link, or at the workspace path a deployment traces. */
export function packageFile(cwd: string, ...path: string[]): string | undefined {
  return [join(cwd, 'node_modules', '@tounsoo', 'todae', ...path), join(cwd, '..', '..', 'packages', 'design-system', ...path)].find(
    (file) => existsSync(file),
  );
}

/**
 * Todae's own `tokens/` directory. The docs app's dependency link resolves in
 * development and tests; the workspace path is the one a deployment traces.
 */
export function todaeTokensDir(cwd = process.cwd()): string {
  const found = packageFile(cwd, 'tokens', 'resolver.json');
  if (!found) throw new Error("Could not find Todae's tokens/resolver.json");
  return dirname(found);
}

/** The built `todae-tokens` CLI, found the same way as the tokens directory. */
export function todaeTokensCli(cwd = process.cwd()): string {
  const found = packageFile(cwd, 'dist', 'scripts', 'build-tokens.js');
  if (!found) throw new Error('Could not find the todae-tokens CLI; build @tounsoo/todae first');
  return found;
}

/**
 * Throws unless every key is a relative `.json` path, no path is a folder of
 * another, the resolver is one of them and the files fit the size limit.
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

/** Drops the temporary folder from a message, which may name files by absolute or cwd-relative path. */
function scrub(message: string, root: string): string {
  let out = message;
  for (const prefix of [relative(process.cwd(), root), root]) {
    out = out.replaceAll(`${prefix}/`, '').replaceAll(prefix, '.');
  }
  return out;
}

export type BuildResult =
  | { ok: true; css: string; overrideTypes: string; source: typeof SOURCE }
  | { ok: false; error: string; source: typeof SOURCE };

type CliRun = { ok: true } | { ok: false; error: string };

/** Runs the CLI in its own Node process, which is killed once `timeout` passes or its heap fills. */
function runCli(cli: string, args: string[], cwd: string, timeout: number): Promise<CliRun> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [`--max-old-space-size=${BUILD_MEMORY_MB}`, cli, ...args],
      { cwd, env: { NODE_ENV: 'production' }, timeout, killSignal: 'SIGKILL', maxBuffer: MAX_ERROR_BYTES },
      (error, _stdout, stderr) => {
        if (!error) return resolve({ ok: true });
        // Node kills a child whose output passes `maxBuffer`, so this comes before the time limit check.
        if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          // Cut at a line break, so no line, and no temporary path in it, is left half written.
          const text = String(stderr);
          const kept = text.slice(0, Math.max(0, text.lastIndexOf('\n'))).trim();
          return resolve({ ok: false, error: `${kept ? `${kept}\n` : ''}The build printed more errors than fit, and the rest were cut` });
        }
        if (error.killed || error.signal) {
          return resolve({ ok: false, error: `The build ran longer than ${timeout / 1000} seconds or ran out of memory, and was stopped` });
        }
        // Node's own message names the server's paths, so it is not passed on.
        resolve({ ok: false, error: String(stderr).trim() || (typeof error.code === 'number' ? `The build failed with exit code ${error.code}` : 'The build failed') });
      },
    );
  });
}

/**
 * Runs `todae-tokens build` on a company's token files, given as contents by
 * path relative to the folder they sit in, with `resolver` naming the
 * resolver among them. The build runs in a child process with a time and
 * memory limit, in a temporary folder that is removed when it ends.
 */
export async function buildTokenFiles(
  files: Record<string, unknown>,
  {
    resolver = 'resolver.json',
    base = todaeTokensDir(),
    cli = todaeTokensCli(),
    timeout = BUILD_TIMEOUT_MS,
  }: { resolver?: string; base?: string; cli?: string; timeout?: number } = {},
): Promise<BuildResult> {
  const contents = checkFiles(files, resolver);
  if (running >= MAX_CONCURRENT_BUILDS) {
    return { ok: false, error: 'The server is running other builds. Try again in a few seconds.', source: SOURCE };
  }
  running += 1;
  const root = await mkdtemp(join(tmpdir(), 'todae-mcp-')).catch((error: unknown) => {
    running -= 1;
    throw error;
  });
  const out = join(root, '.out');
  try {
    for (const [name, text] of contents) {
      const file = join(root, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    await mkdir(out);
    const run = await runCli(
      cli,
      [
        'build',
        '--resolver',
        resolver,
        '--base',
        base,
        '--css',
        join(out, 'theme.css'),
        '--catalog',
        join(out, 'catalog.json'),
        '--types',
        join(out, 'types.ts'),
      ],
      root,
      timeout,
    );
    if (!run.ok) return { ok: false, error: scrub(run.error, root), source: SOURCE };
    const cssFile = join(out, 'theme.css');
    const typesFile = join(out, 'types.ts');
    if ((await stat(cssFile)).size > MAX_CSS_BYTES || (await stat(typesFile)).size > MAX_CSS_BYTES) {
      return { ok: false, error: `The build's output is larger than ${MAX_CSS_BYTES / 1024} KB`, source: SOURCE };
    }
    return { ok: true, css: await readFile(cssFile, 'utf8'), overrideTypes: await readFile(typesFile, 'utf8'), source: SOURCE };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: scrub(message, root), source: SOURCE };
  } finally {
    running -= 1;
    await rm(root, { recursive: true, force: true });
  }
}

/** Todae's own contrast pairs, measured on its base theme. */
export async function baseContrast(base = todaeTokensDir()) {
  const pairs = contrastResults(await resolveEntries(base)).map(({ fg, bg, over, min, where, lc }) => ({
    fg,
    bg,
    ...(over ? { over } : {}),
    min,
    where,
    lc: Math.round(lc * 10) / 10,
  }));
  return { pairs, count: pairs.length, source: SOURCE };
}
