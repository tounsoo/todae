#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  apiBreaks,
  apiSnapshot,
  breakingBump,
  emptyApiSnapshot,
  formatApiSnapshot,
  parseApiSnapshot,
  parseChangeset,
  SNAPSHOT_HINT,
  unacknowledged,
  unacknowledgedFailure,
  usersOf,
  type AddedChangeset,
  type ApiSnapshot,
} from './typescript-api/compare.ts';
import { apiReport } from './typescript-api/report.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '..');
const SNAPSHOT = 'packages/design-system/typescript-api.json';
const PACKAGE_JSON = 'packages/design-system/package.json';

const USAGE = `Usage: check-typescript-api.ts --write | --check | --base <sha> [--head <sha>]

--write  writes typescript-api.json from the package's type exports.
--check  fails when typescript-api.json differs from what --write would write.
--base   fails when a path in typescript-api.json was removed or changed between
         the merge base of --base and --head (default HEAD) and --head, unless a
         changeset that the branch adds names the export. A removal needs a minor
         changeset on 0.x and a major one from 1.0.0. Adding a path is allowed.
`;

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function fileAt(sha: string, path: string): string | null {
  try {
    return git(['show', `${sha}:${path}`]);
  } catch {
    return null;
  }
}

function current(): ApiSnapshot {
  return apiSnapshot(apiReport(PACKAGE_ROOT));
}

function snapshotAt(sha: string): ApiSnapshot | null {
  const text = fileAt(sha, SNAPSHOT);
  return text === null ? null : parseApiSnapshot(text);
}

function addedChangesets(from: string, head: string, packageName: string): AddedChangeset[] {
  const files = git(['diff', '--name-only', '--diff-filter=A', '-M', from, head, '--', ':(top).changeset'])
    .split('\n')
    .filter((file) => file.endsWith('.md') && file !== '.changeset/README.md');
  return files.map((file) => parseChangeset(file, fileAt(head, file) ?? '', packageName));
}

export function checkRange(base: string, head: string): string | null {
  const from = git(['merge-base', base, head]).trim();
  const before = snapshotAt(from) ?? emptyApiSnapshot();
  const after = snapshotAt(head);
  if (after === null) {
    if (Object.keys(before.entries).length === 0) return null;
    return `typescript-api.json is missing at ${head}. ${SNAPSHOT_HINT}`;
  }
  const packageJson = JSON.parse(fileAt(head, PACKAGE_JSON) ?? '{}') as { name?: string; version?: string };
  if (!packageJson.name || !packageJson.version) return `${PACKAGE_JSON} at ${head} has no name or version.`;
  const missing = unacknowledged(
    apiBreaks(before, after),
    addedChangesets(from, head, packageJson.name),
    breakingBump(packageJson.version),
    usersOf([before, after]),
  );
  return missing.length === 0 ? null : unacknowledgedFailure(missing, packageJson.name);
}

function run(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      write: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      base: { type: 'string' },
      head: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  const file = join(PACKAGE_ROOT, 'typescript-api.json');
  if (values.help) {
    process.stdout.write(USAGE);
  } else if (values.write) {
    writeFileSync(file, formatApiSnapshot(current()));
    process.stdout.write('Wrote typescript-api.json.\n');
  } else if (values.check) {
    let committed: string;
    try {
      committed = readFileSync(file, 'utf8');
    } catch {
      throw new Error(`typescript-api.json is missing. ${SNAPSHOT_HINT}`);
    }
    if (committed !== formatApiSnapshot(current())) {
      throw new Error(`typescript-api.json does not match the package's type exports. ${SNAPSHOT_HINT}`);
    }
    process.stdout.write('typescript-api.json matches the type exports.\n');
  } else if (values.base !== undefined) {
    const failure = checkRange(values.base, values.head ?? 'HEAD');
    if (failure !== null) throw new Error(failure);
    process.stdout.write('Public TypeScript API has no unacknowledged removals or changes.\n');
  } else {
    throw new Error(USAGE);
  }
}

function invokedPath(): string | null {
  try {
    return process.argv[1] ? realpathSync(resolve(process.argv[1])) : null;
  } catch {
    return null;
  }
}

const invoked = invokedPath();
if (invoked && pathToFileURL(invoked).href === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
