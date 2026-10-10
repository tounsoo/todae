import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKER, blockReason, isPush } from './review-gate.mjs';

const hook = join(import.meta.dirname, 'review-gate.mjs');

/** A clone of a fresh origin with one commit on main, and one more on a branch. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'review-gate-'));
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'config', 'user.email', 'test@example.com');
  git(work, 'config', 'user.name', 'Test');
  git(work, 'config', 'commit.gpgsign', 'false');
  git(work, 'commit', '-q', '--allow-empty', '-m', 'main');
  git(work, 'push', '-q', 'origin', 'main');
  git(work, 'checkout', '-q', '-b', 'feature');
  return { work, git: (...args) => git(work, ...args) };
}

function runHook(cwd, command, tool = 'Bash') {
  return spawnSync('node', [hook], {
    input: JSON.stringify({ tool_name: tool, tool_input: { command }, cwd }),
    encoding: 'utf8',
  });
}

test('recognizes git push however it is written', () => {
  for (const command of [
    'git push',
    'git push -u origin feature',
    'cd x && git push origin feature',
    'git -C . push',
    'git -c push.default=current push',
    '(git push)',
  ]) {
    assert.equal(isPush(command), true, command);
  }
  for (const command of ['git status', 'git pushd', 'echo git push-later', 'git log --grep push', 'gh pr view']) {
    assert.equal(isPush(command), false, command);
  }
});

test('lets a branch with nothing beyond main push', () => {
  const { work } = repo();
  assert.equal(blockReason(work), null);
});

test('blocks a commit no review round has passed, until the marker names it', () => {
  const { work, git } = repo();
  git('commit', '-q', '--allow-empty', '-m', 'fix');
  assert.match(blockReason(work), /Push blocked/);

  writeFileSync(join(work, git('rev-parse', '--git-path', MARKER)), `${git('rev-parse', 'HEAD')}\n`);
  assert.equal(blockReason(work), null);

  // A fix committed after the clean round needs a round of its own.
  git('commit', '-q', '--allow-empty', '-m', 'another fix');
  assert.match(blockReason(work), /Push blocked/);
});

test('exits 2 with the reason for a blocked push, and stays out of everything else', () => {
  const { work, git } = repo();
  git('commit', '-q', '--allow-empty', '-m', 'fix');
  const blocked = runHook(work, 'git push -u origin feature');
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /review round/);
  assert.equal(runHook(work, 'git status').status, 0);
  assert.equal(runHook(work, 'git push', 'Read').status, 0);
});
