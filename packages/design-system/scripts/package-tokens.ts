import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildTokens, buildTokensGraph, type BuildTokensResult } from './build-tokens.ts';
import { parseSnapshot, type ConsumerFile } from './tokens/consumers.ts';
import {
  addedLine,
  collectViolations,
  formatGrandfather,
  hint,
  isConsumerPath,
  parseGrandfather,
  parseSchema,
  ratchet,
  staleLine,
  tallyLine,
  type Grandfather,
} from './tokens/names.ts';
import { fail } from './tokens/shared.ts';

type PreparedNames = { found: ReturnType<typeof collectViolations>; list: Grandfather | null };

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()) {
    return error.stderr.trim();
  }
  return error instanceof Error ? error.message : String(error);
}

function git(cwd: string, args: string[]): string {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function listConsumerPaths(pkgRoot: string): Promise<string[]> {
  try {
    return git(pkgRoot, ['ls-files', '-z', '--', 'src']).split('\0').filter((path) => isConsumerPath(path));
  } catch (error) {
    if (!/not a git repository/.test(errorText(error))) throw error;
    return walkConsumerPaths(pkgRoot);
  }
}

async function walkConsumerPaths(pkgRoot: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) {
        const path = relative(pkgRoot, full).split(sep).join('/');
        if (isConsumerPath(path)) out.push(path);
      }
    }
  };
  await visit(join(pkgRoot, 'src'));
  out.sort();
  return out;
}

async function loadConsumerFiles(pkgRoot: string): Promise<ConsumerFile[]> {
  const paths = await listConsumerPaths(pkgRoot);
  const files: ConsumerFile[] = [];
  for (const path of paths) files.push({ path, source: await readFile(join(pkgRoot, path), 'utf8') });
  return files;
}

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function prepareNames(pkgRoot: string, catalogJson: string): Promise<PreparedNames> {
  const schemaText = await readText(join(pkgRoot, 'tokens', 'name-schema.json'));
  if (schemaText === null) fail('tokens/name-schema.json is missing');
  const snapshot = parseSnapshot(JSON.parse(catalogJson) as unknown);
  const schema = parseSchema(JSON.parse(schemaText) as unknown);
  const found = collectViolations(snapshot, schema, await loadConsumerFiles(pkgRoot));
  const listText = await readText(join(pkgRoot, 'tokens', 'name-grandfather.json'));
  return { found, list: listText === null ? null : parseGrandfather(JSON.parse(listText) as unknown) };
}

async function writeGrandfatherList(pkgRoot: string, catalogJson: string): Promise<void> {
  const { found, list } = await prepareNames(pkgRoot, catalogJson);
  const formatted = formatGrandfather(found);
  if (list) {
    const next = parseGrandfather(JSON.parse(formatted) as unknown);
    const { added } = ratchet({ found, list: next, base: list });
    if (added.length > 0) fail(added.map((violation) => addedLine(violation)).join('\n'));
  }
  const file = join(pkgRoot, 'tokens', 'name-grandfather.json');
  if ((await readText(file)) !== formatted) await writeFile(file, formatted);
}

function baseGrandfather(pkgRoot: string, sha: string): Grandfather | null {
  let top: string;
  try {
    top = git(pkgRoot, ['rev-parse', '--show-toplevel']).trim();
  } catch (error) {
    fail(`tokens:check --base needs a git checkout (${errorText(error)})`);
  }
  const file = relative(top, join(pkgRoot, 'tokens', 'name-grandfather.json')).split(sep).join('/');
  try {
    return parseGrandfather(JSON.parse(git(pkgRoot, ['show', `${sha}:${file}`])) as unknown);
  } catch (error) {
    const detail = errorText(error);
    if (/does not exist|but not in/.test(detail)) return null;
    fail(`tokens:check --base ${sha} failed: ${detail}`);
  }
}

async function enforceNameRatchet(pkgRoot: string, catalogJson: string, base: string | undefined): Promise<void> {
  const { found, list } = await prepareNames(pkgRoot, catalogJson);
  if (!list) fail('tokens/name-grandfather.json is missing. Run pnpm tokens:grandfather.');
  const baseList = base === undefined ? undefined : baseGrandfather(pkgRoot, base);
  const result = ratchet({ found, list, ...(base === undefined ? {} : { base: baseList ?? 'missing' }) });
  if (result.note) process.stdout.write(`${result.note}\n`);
  const messages = [
    ...result.unlisted.map((violation) => hint(violation)),
    ...result.stale.map((violation) => staleLine(violation)),
    ...result.added.map((violation) => addedLine(violation)),
  ];
  if (messages.length > 0) fail(messages.join('\n'));
  process.stdout.write(`${tallyLine(found, result.unlisted)}\n`);
}

export async function buildPackageTokens(
  options: { check?: boolean; root?: string; base?: string; writeGrandfather?: boolean } = {},
): Promise<BuildTokensResult> {
  const pkgRoot = options.root ?? join(import.meta.dirname, '..');
  if (options.writeGrandfather === true && options.check !== true) {
    const result = await buildTokensGraph(join(pkgRoot, 'tokens'));
    await writeGrandfatherList(pkgRoot, result.json);
    return result;
  }
  const result = await buildTokens({ check: true, root: pkgRoot });
  await enforceNameRatchet(pkgRoot, result.json, options.base);
  return result;
}

function selfFlags(args: readonly string[]): { check: boolean; base?: string; writeGrandfather: boolean } {
  let check = false;
  let writeGrandfather = false;
  let base: string | undefined;
  for (let index = args[0] === 'self' ? 1 : 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--check') check = true;
    else if (arg === '--write-grandfather') writeGrandfather = true;
    else if (arg === '--base') {
      const sha = args[index + 1];
      if (sha === undefined || sha.startsWith('--')) fail('tokens:check --base needs a commit');
      base = sha;
      index += 1;
    } else fail(`unknown argument ${arg ?? ''}`);
  }
  if (base !== undefined && !check) fail('--base requires --check');
  if (!check && !writeGrandfather) fail('Usage: package-tokens --check [--base <sha>] | --write-grandfather');
  return { check, writeGrandfather, ...(base !== undefined ? { base } : {}) };
}

function invokedPath(): string | null {
  try {
    return process.argv[1] ? realpathSync(resolve(process.argv[1])) : null;
  } catch {
    return null;
  }
}

const entry = invokedPath();
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    const flags = selfFlags(args);
    await buildPackageTokens({
      check: flags.check,
      writeGrandfather: flags.writeGrandfather,
      ...(flags.base !== undefined ? { base: flags.base } : {}),
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
