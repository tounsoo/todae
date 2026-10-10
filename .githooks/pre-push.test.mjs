import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const hooks = import.meta.dirname;

/**
 * A clone with one commit on main, pushed to its origin, and a feature
 * branch checked out. `push` runs as Claude Code does unless `claude` is false.
 */
function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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
    const env = { ...process.env };
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
    { cwd: work, env: { ...process.env, CLAUDECODE: '1' }, encoding: 'utf8' },
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
  // Deleting a remote branch sends no commits.
  assert.equal(push(['feature']).status, 0);
  assert.equal(push(['--delete', 'feature']).status, 0);
});

test('gates the repository the push runs in, wherever the command starts', (t) => {
  const { root, work, commit } = repo(t);
  commit('fix');
  const result = spawnSync('git', ['-C', work, 'push', '-q', 'origin', 'feature'], {
    cwd: root,
    env: { ...process.env, CLAUDECODE: '1' },
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
