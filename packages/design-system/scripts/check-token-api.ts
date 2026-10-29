#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  APPROVAL_HINT,
  auditTokenApiHistory,
  emptyTokenApiApprovals,
  emptyTokenApiSnapshot,
  parseTokenApiApprovals,
  parseTokenApiSnapshot,
  removalFailure,
  withoutApprovals,
  type TokenApiApprovals,
  type TokenApiBreak,
  type TokenApiSnapshot,
} from './tokens/api.ts';
import { fail } from './tokens/shared.ts';

const SNAPSHOT = 'packages/design-system/tokens/api.json';
const APPROVALS = 'packages/design-system/tokens/api-approved-removals.json';

const USAGE = `Usage: check-token-api.ts [--base <sha>] [--head <sha>]

Defaults are --base origin/main --head HEAD. Fails when a public token path
disappeared or its type changed between the base and the head, including a
path that a later commit puts back. A changeset does not waive that. A path
listed in tokens/api-approved-removals.json with a filled approval note is
skipped. Adding a path is allowed.
`;

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function fileAt(sha: string, path: string): string | null {
  try {
    return git(['show', `${sha}:${path}`]);
  } catch {
    return null;
  }
}

function snapshotAt(sha: string, seen: { value: boolean }): TokenApiSnapshot {
  const text = fileAt(sha, SNAPSHOT);
  if (text === null) {
    if (seen.value) {
      fail(`tokens/api.json is missing from a commit after it was added. ${APPROVAL_HINT}`);
    }
    // No tokens/api.json at the base means an empty snapshot. The first pull
    // request, which only adds the file, always passes. A later commit on that
    // pull request can still remove or retype a path.
    return emptyTokenApiSnapshot();
  }
  seen.value = true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    fail(`tokens/api.json at ${sha} is not valid JSON. Run pnpm tokens and commit tokens/api.json.`);
  }
  return parseTokenApiSnapshot(parsed);
}

function commitsBetween(base: string, head: string): string[] {
  let text: string;
  try {
    // --first-parent skips commits merged in from main. Those snapshots can
    // lack a path this branch added, which is not a removal on this branch.
    text = git(['rev-list', '--reverse', '--first-parent', `${base}..${head}`]);
  } catch {
    fail(`Could not read commits from ${base} to ${head}.`);
  }
  return text.split('\n').filter((line) => line.length > 0);
}

function approvalsAt(sha: string): TokenApiApprovals {
  const text = fileAt(sha, APPROVALS);
  if (text === null) return emptyTokenApiApprovals();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    fail('tokens/api-approved-removals.json is not valid JSON.');
  }
  return parseTokenApiApprovals(parsed);
}

export function auditRange(base: string, head: string): TokenApiBreak[] {
  const seen = { value: false };
  const snapshots = [snapshotAt(base, seen), ...commitsBetween(base, head).map((sha) => snapshotAt(sha, seen))];
  return withoutApprovals(auditTokenApiHistory(snapshots), approvalsAt(head));
}

function run(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  const base = values.base ?? 'origin/main';
  const head = values.head ?? 'HEAD';
  const removed = auditRange(base, head);
  if (removed.length > 0) fail(removalFailure(removed));
  process.stdout.write('Public token API has no removals or renames.\n');
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
