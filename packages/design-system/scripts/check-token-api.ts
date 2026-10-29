#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  auditTokenApiHistory,
  emptyTokenApiSnapshot,
  parseTokenApiSnapshot,
  removalFailure,
  type TokenApiSnapshot,
} from './tokens/api.ts';
import { fail } from './tokens/shared.ts';

const SNAPSHOT = 'packages/design-system/tokens/api.json';

const USAGE = `Usage: check-token-api.ts --base <sha> --head <sha>

Fails when a public token path in tokens/api.json disappeared between the base
and the head, including a path that a later commit puts back. A changeset does
not waive a removal or a rename. Adding a path is allowed.
`;

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function snapshotText(sha: string): string | null {
  try {
    return git(['show', `${sha}:${SNAPSHOT}`]);
  } catch {
    return null;
  }
}

function snapshotAt(sha: string, seen: { value: boolean }): TokenApiSnapshot {
  const text = snapshotText(sha);
  if (text === null) {
    if (seen.value) {
      fail(
        'tokens/api.json is missing from a commit after it was added. A changeset does not waive this. A removal needs Ben\'s approval.',
      );
    }
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
    text = git(['rev-list', '--reverse', `${base}..${head}`]);
  } catch {
    fail(`Could not read commits from ${base} to ${head}.`);
  }
  return text.split('\n').filter((line) => line.length > 0);
}

export function auditRange(base: string, head: string): string[] {
  const seen = { value: false };
  const snapshots = [snapshotAt(base, seen), ...commitsBetween(base, head).map((sha) => snapshotAt(sha, seen))];
  return auditTokenApiHistory(snapshots);
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
  if (!values.base || !values.head) fail(USAGE);
  const removed = auditRange(values.base, values.head);
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
