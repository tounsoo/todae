#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { buildReport, diffSnapshots, parseSnapshot, renderMarkdown, type ConsumerFile, type Snapshot } from './tokens/consumers.ts';

const CATALOG = 'packages/design-system/tokens/tokens.generated.json';

const USAGE = `Usage: token-consumers.ts [--base <sha>] [--head <sha>] [--summary <file>]

Defaults are --base origin/main --head HEAD. Prints the components that read
a token whose value or type changed. Appends the same report to --summary.
Exits 0 even when the report cannot be built.
`;

function summaryArg(argv: string[]): string | undefined {
  const index = argv.indexOf('--summary');
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function emit(text: string, summary: string | undefined): void {
  const body = text.endsWith('\n') ? text : `${text}\n`;
  process.stdout.write(body);
  if (!summary) return;
  try {
    appendFileSync(summary, body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stdout.write(`Token consumer report unavailable: ${reason}\n`);
  }
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : '';
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(stderr || message, { cause: error });
  }
}

function resolveSha(rev: string): string {
  return git(['rev-parse', '--verify', `${rev}^{commit}`]).trim();
}

function fileAt(sha: string, path: string): string | null {
  try {
    git(['cat-file', '-e', `${sha}:${path}`]);
  } catch {
    return null;
  }
  return git(['show', `${sha}:${path}`]);
}

function filesAt(sha: string): string[] {
  // --full-tree keeps paths from the repository root. pnpm exec runs this
  // script in the package directory, where a plain ls-tree would drop the prefix.
  return git(['ls-tree', '-r', '--full-tree', '--name-only', sha]).split('\n').filter((line) => line.length > 0);
}

function isConsumerPath(file: string): boolean {
  if (file.endsWith('.generated.css') || file.endsWith('.test.tsx') || file.endsWith('.test.ts')) return false;
  if (/^packages\/design-system\/src\/components\/[^/]+\.module\.css$/.test(file)) return true;
  if (/^packages\/design-system\/src\/components\/[^/]+\.tsx$/.test(file)) return true;
  return /^packages\/design-system\/src\/.+\.css$/.test(file) && !file.endsWith('.module.css');
}

function loadFiles(sha: string, tree: 'head' | 'base'): ConsumerFile[] {
  const files: ConsumerFile[] = [];
  for (const path of filesAt(sha)) {
    if (!isConsumerPath(path)) continue;
    const source = fileAt(sha, path);
    if (source === null) continue;
    files.push({ path, source, tree });
  }
  return files;
}

function snapshotAt(sha: string, path: string): { snapshot: Snapshot; missing: boolean } {
  const text = fileAt(sha, path);
  if (text === null) return { snapshot: parseSnapshot({ version: 1, tokens: [] }), missing: true };
  return { snapshot: parseSnapshot(JSON.parse(text) as unknown), missing: false };
}

function reportRange(base: string, head: string): string {
  const baseSha = resolveSha(base);
  const headSha = resolveSha(head);
  const baseCatalog = snapshotAt(baseSha, CATALOG);
  const headCatalog = snapshotAt(headSha, CATALOG);
  const files = loadFiles(headSha, 'head');
  if (diffSnapshots(baseCatalog.snapshot, headCatalog.snapshot).some((change) => change.kind === 'removed')) {
    files.push(...loadFiles(baseSha, 'base'));
  }
  const report = buildReport({ base: baseCatalog.snapshot, head: headCatalog.snapshot, files });
  return renderMarkdown(report, { base: baseSha, head: headSha, baseMissing: baseCatalog.missing });
}

function run(argv: string[]): void {
  const summary = summaryArg(argv);
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        base: { type: 'string' },
        head: { type: 'string' },
        summary: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    });
    if (values.help) {
      emit(USAGE, summary);
      return;
    }
    emit(reportRange(values.base ?? 'origin/main', values.head ?? 'HEAD'), summary);
  } catch (error) {
    emit(`Token consumer report unavailable: ${error instanceof Error ? error.message : String(error)}`, summary);
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
  run(process.argv.slice(2));
}
