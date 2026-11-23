import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { aptCommands, findAptInstalls, selfTest } from './ci-apt-install.mjs';

const script = fileURLToPath(new URL('./ci-apt-install.mjs', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));

const pullRequest = (run) => `on: pull_request\njobs:\n  engines:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: ${run}\n`;

const commands = (text) => findAptInstalls(text).map((hit) => hit.command);

test('a browser install without apt packages is not this class', () => {
  assert.deepEqual(commands(pullRequest('pnpm exec playwright install webkit')), []);
  assert.deepEqual(commands(pullRequest('pnpm install --frozen-lockfile')), []);
  assert.deepEqual(commands(pullRequest('"node .github/scripts/ci-apt-install.mjs --self-test"')), []);
  assert.deepEqual(aptCommands('# playwright install --with-deps webkit\necho ok').map((hit) => hit.command), []);
});

test('a pinned Playwright package and apt-get options are still apt installs', () => {
  assert.deepEqual(commands(pullRequest('"npx playwright@1.64.1 install --with-deps webkit"')), ['npx playwright@1.64.1 install --with-deps webkit']);
  assert.deepEqual(commands(pullRequest('"sudo apt-get -o Acquire::Retries=3 install -y libgtk-3-0t64"')), [
    'sudo apt-get -o Acquire::Retries=3 install -y libgtk-3-0t64',
  ]);
});

test('apt-get, a continued line and a block scalar are flagged, and a comment is not', () => {
  assert.deepEqual(commands(pullRequest('"sudo apt-get install -y libgtk-3-0"')), ['sudo apt-get install -y libgtk-3-0']);
  const continued = pullRequest('|\n          pnpm exec playwright install \\\n            --with-deps webkit\n');
  assert.deepEqual(commands(continued), ['pnpm exec playwright install --with-deps webkit']);
  const commented = pullRequest('|\n          # playwright install --with-deps webkit\n          echo ok\n');
  assert.deepEqual(commands(commented), []);
  assert.deepEqual(commands(pullRequest(JSON.stringify('echo ok # apt-get install -y libgtk'))), []);
});

test('workflow_dispatch stays out, and the same command on a pull request does not', () => {
  const command = 'pnpm --filter bench exec playwright install --with-deps chromium';
  const body = `jobs:\n  bench:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: ${JSON.stringify(command)}\n`;
  assert.deepEqual(commands(`on: workflow_dispatch\n${body}`), []);
  assert.deepEqual(commands(`on:\n  workflow_dispatch:\n${body}`), []);
  assert.deepEqual(commands(`on:\n  pull_request:\n  workflow_dispatch:\n${body}`), [command]);
});

test('the repo passes, including the historical proof', () => {
  assert.deepEqual(selfTest(), []);
});

test('a shell operator or a path to the binary still counts as an apt install', () => {
  const cases = [
    ['pnpm exec playwright install --with-deps;', 'pnpm exec playwright install --with-deps'],
    ['pnpm exec playwright install-deps; echo done', 'pnpm exec playwright install-deps'],
    ['playwright install --with-deps&&echo ok', 'playwright install --with-deps'],
    ['(cd apps/docs && pnpm exec playwright install --with-deps)', 'pnpm exec playwright install --with-deps'],
    ['./node_modules/.bin/playwright install --with-deps', './node_modules/.bin/playwright install --with-deps'],
    ['/usr/bin/apt-get install', '/usr/bin/apt-get install'],
    ['playwright install --with-deps || true', 'playwright install --with-deps'],
    ['playwright install --with-deps | cat', 'playwright install --with-deps'],
  ];
  for (const [command, expected] of cases) {
    assert.deepEqual(commands(pullRequest(JSON.stringify(command))), [expected], command);
  }
});

test('a quoted sentence is not an apt install', () => {
  assert.deepEqual(commands(pullRequest(JSON.stringify('echo "use apt-get to install"'))), []);
  assert.deepEqual(commands(pullRequest(JSON.stringify("echo 'use apt-get to install'"))), []);
  assert.deepEqual(commands(pullRequest(JSON.stringify('echo "use apt-get to install" && apt-get install -y foo'))), ['apt-get install -y foo']);
});

test('a reusable workflow is in scope', () => {
  const command = 'pnpm exec playwright install --with-deps webkit';
  const body = `jobs:\n  engines:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: ${JSON.stringify(command)}\n`;
  assert.deepEqual(commands(`on: workflow_call\n${body}`), [command]);
  assert.deepEqual(commands(`on:\n  workflow_call:\n${body}`), [command]);
});

test('the check fails on the #347 and #381 steps and passes on this repo', () => {
  for (const name of ['347.yml', '381.yml']) {
    const fixture = join(root, '.github/scripts/fixtures/ci-apt-install', name);
    const failed = spawnSync(process.execPath, [script, fixture], { encoding: 'utf8' });
    assert.equal(failed.status, 1, failed.stderr);
    assert.match(failed.stderr, new RegExp(`${name}:\\d+: fernway:`));
    assert.match(failed.stderr, new RegExp(`${name}:\\d+: engines:`));
    assert.match(failed.stderr, new RegExp(`${name}:\\d+: docs:`));
    assert.match(failed.stderr, /mcr\.microsoft\.com\/playwright/);
  }
  const head = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  assert.equal(head.status, 0, head.stderr);
  const passed = spawnSync(process.execPath, [script, '--self-test'], { cwd: root, encoding: 'utf8' });
  assert.equal(passed.status, 0, passed.stderr);
});

test('pnpm check runs the apt install check', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.check, /node \.github\/scripts\/ci-apt-install\.mjs --self-test/);
});
