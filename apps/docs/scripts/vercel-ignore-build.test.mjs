import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { decide } from './vercel-ignore-build.mjs';

const repo = { VERCEL_GIT_REPO_OWNER: 'tounsoo', VERCEL_GIT_REPO_SLUG: 'todae' };
const preview = (ref, extra = {}) => ({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: ref, ...repo, ...extra });

function github(body, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, fetchImpl };
}

const never = async () => {
  throw new Error('GitHub should not be read');
};

test('docs-stable production always builds without reading GitHub', async () => {
  const result = await decide({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'docs-stable', ...repo }, never);
  assert.equal(result.build, true);
});

test('main builds without reading GitHub', async () => {
  assert.equal((await decide(preview('main'), never)).build, true);
});

test('docs-stable builds even when Vercel calls it a preview', async () => {
  assert.equal((await decide(preview('docs-stable'), never)).build, true);
});

test('a draft pull request skips the build', async () => {
  const { calls, fetchImpl } = github([{ number: 12, state: 'open', draft: true }]);
  const result = await decide(preview('claude/work'), fetchImpl);
  assert.equal(result.build, false);
  assert.match(result.reason, /#12 is a draft/);
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/tounsoo/todae/pulls?state=open&per_page=10&head=tounsoo%3Aclaude%2Fwork',
  );
});

test('a pull request ready for review builds', async () => {
  const { fetchImpl } = github([{ number: 12, state: 'open', draft: false }]);
  assert.equal((await decide(preview('claude/work'), fetchImpl)).build, true);
});

test('a branch with no open pull request skips the build', async () => {
  const { fetchImpl } = github([]);
  const result = await decide(preview('changesets-ghcommit-temp/changeset-release/main'), fetchImpl);
  assert.equal(result.build, false);
});

test("Vercel's pull request id is read directly", async () => {
  const ready = github({ number: 7, state: 'open', draft: false });
  assert.equal((await decide(preview('fork-branch', { VERCEL_GIT_PULL_REQUEST_ID: '7' }), ready.fetchImpl)).build, true);
  assert.equal(ready.calls[0].url, 'https://api.github.com/repos/tounsoo/todae/pulls/7');

  const draft = github({ number: 7, state: 'open', draft: true });
  assert.equal((await decide(preview('fork-branch', { VERCEL_GIT_PULL_REQUEST_ID: '7' }), draft.fetchImpl)).build, false);

  const closed = github({ number: 7, state: 'closed', draft: false });
  assert.equal((await decide(preview('fork-branch', { VERCEL_GIT_PULL_REQUEST_ID: '7' }), closed.fetchImpl)).build, false);
});

test('a GitHub error or outage builds', async () => {
  assert.equal((await decide(preview('claude/work'), github({ message: 'rate limited' }, 403).fetchImpl)).build, true);
  const offline = async () => {
    throw new Error('network down');
  };
  assert.equal((await decide(preview('claude/work'), offline)).build, true);
});

test('missing Git details build', async () => {
  assert.equal((await decide({ VERCEL_ENV: 'preview' }, never)).build, true);
  assert.equal((await decide({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'claude/work' }, never)).build, true);
});

test('a GITHUB_TOKEN is sent when set', async () => {
  const { calls, fetchImpl } = github([]);
  await decide(preview('claude/work', { GITHUB_TOKEN: 'abc' }), fetchImpl);
  assert.equal(calls[0].init.headers.authorization, 'Bearer abc');
});

test('the script exits 1 to build and 0 to skip', () => {
  const script = fileURLToPath(new URL('./vercel-ignore-build.mjs', import.meta.url));
  const run = (env) => spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const main = run(preview('main'));
  assert.equal(main.status, 1, main.stderr);
  assert.match(main.stdout, /^Building: main always builds\./);
  const production = run({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'docs-stable', ...repo });
  assert.equal(production.status, 1, production.stderr);
});
