import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const hooks = import.meta.dirname;

/** The environment without any outer git state, so a test never touches the repository running it. */
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const gitEnv = { ...cleanEnv, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/**
 * A clone with one commit on main, pushed to its origin, and a feature
 * branch checked out. `push` runs as Claude Code does unless `claude` is false.
 */
function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (cwd, ...args) =>
    execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  run(root, 'init', '-q', '--bare', origin);
  run(root, 'init', '-q', work);
  const git = (...args) => run(work, ...args);
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  git('remote', 'add', 'origin', origin);
  git('commit', '-q', '--allow-empty', '-m', 'main');
  git('push', '-q', 'origin', 'HEAD:refs/heads/main');
  git('fetch', '-q', 'origin');
  git('checkout', '-q', '-b', 'feature');
  git('config', 'core.hooksPath', hooks);
  const commit = (message) => git('commit', '-q', '--allow-empty', '-m', message);
  const markClean = () => writeFileSync(join(work, git('rev-parse', '--git-path', 'todae-review-clean')), `${git('rev-parse', 'HEAD')}\n`);
  const push = (args, { claude = true } = {}) => {
    const env = { ...gitEnv };
    if (claude) env.CLAUDECODE = '1';
    else delete env.CLAUDECODE;
    return spawnSync('git', ['push', '-q', 'origin', ...args], { cwd: work, env, encoding: 'utf8' });
  };
  return { root, work, git, commit, markClean, push };
}

test('lets a branch with nothing new push', (t) => {
  const { push } = repo(t);
  assert.equal(push(['feature']).status, 0);
});

test('blocks a commit no review round has passed, and says how to record a clean one', (t) => {
  const { commit, push } = repo(t);
  commit('fix');
  const result = push(['feature']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Push blocked: refs\/heads\/feature/);
  assert.match(result.stderr, /todae-review-clean/);
});

test('lets the reviewed commit, and any commit before it, push', (t) => {
  const { commit, markClean, push } = repo(t);
  commit('first');
  commit('second');
  markClean();
  assert.equal(push(['HEAD~1:refs/heads/partial']).status, 0);
  assert.equal(push(['feature']).status, 0);
});

test('blocks a commit made after the clean round, even when commit and push share one command', (t) => {
  const { work, commit, markClean } = repo(t);
  commit('reviewed');
  markClean();
  const result = spawnSync(
    'sh',
    ['-c', 'git commit -q --allow-empty -m unreviewed && git push -q origin feature'],
    { cwd: work, env: { ...gitEnv, CLAUDECODE: '1' }, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Push blocked/);
});

test('checks what is pushed, not what is checked out', (t) => {
  const { git, commit, markClean, push } = repo(t);
  git('checkout', '-q', '-b', 'wip');
  commit('wip');
  git('checkout', '-q', 'feature');
  markClean();
  assert.notEqual(push(['wip:refs/heads/main']).status, 0);
  assert.equal(push(['feature']).status, 0);
  // Deleting a remote branch sends no commits, even while an unreviewed one is checked out.
  git('checkout', '-q', 'wip');
  assert.equal(push(['--delete', 'feature']).status, 0);
});

test('gates the repository the push runs in, wherever the command starts', (t) => {
  const { root, work, commit } = repo(t);
  commit('fix');
  const result = spawnSync('git', ['-C', work, 'push', '-q', 'origin', 'feature'], {
    cwd: root,
    env: { ...gitEnv, CLAUDECODE: '1' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});

test('works through a symlinked hooks path', (t) => {
  const { root, git, commit, push } = repo(t);
  const link = join(root, 'hooks-link');
  symlinkSync(hooks, link);
  git('config', 'core.hooksPath', link);
  commit('fix');
  assert.notEqual(push(['feature']).status, 0);
});

test('leaves people pushing from their own shell alone', (t) => {
  const { commit, push } = repo(t);
  commit('fix');
  assert.equal(push(['feature'], { claude: false }).status, 0);
});

test('installs into the clone without touching core.hooksPath or another pre-push hook', (t) => {
  const { work, git, commit, push } = repo(t);
  git('config', '--unset', 'core.hooksPath');
  // The installed hook runs .githooks/pre-push from the checkout.
  execFileSync('cp', ['-R', hooks, join(work, '.githooks')]);
  const install = () =>
    spawnSync('sh', [join(hooks, 'install')], { env: { ...gitEnv, CLAUDE_PROJECT_DIR: work }, encoding: 'utf8' });
  assert.equal(install().status, 0);
  assert.equal(install().status, 0);
  assert.equal(spawnSync('git', ['config', 'core.hooksPath'], { cwd: work, env: gitEnv }).status, 1);
  commit('fix');
  assert.notEqual(push(['feature']).status, 0);

  // A checkout without .githooks pushes freely.
  execFileSync('rm', ['-r', join(work, '.githooks')]);
  assert.equal(push(['feature']).status, 0);

  // Someone else's pre-push hook stays as it is.
  const own = join(work, git('rev-parse', '--git-path', 'hooks'), 'pre-push');
  writeFileSync(own, '#!/bin/sh\nexit 0\n');
  const result = install();
  assert.equal(result.status, 0);
  assert.match(result.stderr, /already exists/);
  assert.equal(readFileSync(own, 'utf8'), '#!/bin/sh\nexit 0\n');
});
