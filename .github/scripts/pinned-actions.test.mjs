import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultFiles, findUnpinned, scan } from './pinned-actions.mjs';

const sha = '11d5960a326750d5838078e36cf38b85af677262';
const digest = `sha256:${'0123456789abcdef'.repeat(4)}`;
const script = fileURLToPath(new URL('./pinned-actions.mjs', import.meta.url));

const workflow = (step) => `on: push\njobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n      ${step}\n`;
const refs = (text) => findUnpinned(text).map((hit) => hit.ref);

test('commit SHAs, local actions and docker digests pass', () => {
  for (const step of [
    `- uses: actions/checkout@${sha} # v4.4.0`,
    `- uses: actions/cache/save@${sha}`,
    `- uses: "actions/checkout@${sha}"`,
    `- uses: 'actions/checkout@${sha}'`,
    '- uses: ./.github/actions/setup',
    `- uses: docker://alpine@${digest}`,
    `- {uses: actions/checkout@${sha}}`,
    `- uses:\n          actions/checkout@${sha}`,
    `- uses: >-\n          actions/checkout@${sha}`,
    '- run: |\n          echo "uses: actions/checkout@v4"\n          uses: actions/checkout@v4',
    '- run: echo hi\n        with:\n          uses: actions/checkout@v4',
  ]) {
    assert.deepEqual(refs(workflow(step)), [], step);
  }
  assert.deepEqual(refs(`jobs:\n  a:\n    uses: octo/repo/.github/workflows/build.yml@${sha}\n`), []);
});

test('tags, branches, short or uppercase SHAs and tagged docker images fail', () => {
  for (const [step, ref] of [
    ['- uses: actions/checkout@v4', 'actions/checkout@v4'],
    ['- uses: actions/checkout@main', 'actions/checkout@main'],
    [`- uses: actions/checkout@v4 # ${sha}`, 'actions/checkout@v4'],
    ['- uses: actions/checkout@11d5960 # v4.4.0', 'actions/checkout@11d5960'],
    [`- uses: actions/checkout@${sha.toUpperCase()}`, `actions/checkout@${sha.toUpperCase()}`],
    [`- uses: actions/checkout@${sha}0`, `actions/checkout@${sha}0`],
    ['- uses: actions/checkout', 'actions/checkout'],
    ['- uses: "actions/checkout@v4"', 'actions/checkout@v4'],
    ['- uses: docker://alpine:3.20', 'docker://alpine:3.20'],
  ]) {
    assert.deepEqual(refs(workflow(step)), [ref], step);
  }
  assert.deepEqual(refs('jobs:\n  a:\n    uses: octo/repo/.github/workflows/build.yml@main\n'), [
    'octo/repo/.github/workflows/build.yml@main',
  ]);
});

test('every YAML spelling of a step is read', () => {
  for (const step of [
    '- {uses: actions/checkout@v4}',
    '- "uses": actions/checkout@v4',
    '- uses : actions/checkout@v4',
    "- 'uses': actions/checkout@v4",
    '- {name: co, uses: actions/checkout@v4}',
    '- ? uses\n        : actions/checkout@v4',
    '- uses: &co actions/checkout@v4',
    '- uses:\n          actions/checkout@v4',
    '- uses: >-\n          actions/checkout@v4',
  ]) {
    assert.deepEqual(refs(workflow(step)), ['actions/checkout@v4'], step);
  }
  assert.deepEqual(refs('jobs:\n  a:\n    steps: [{uses: actions/checkout@v4}]\n'), ['actions/checkout@v4']);
  assert.deepEqual(refs('jobs:\n  call: {uses: octo/repo/.github/workflows/x.yml@main}\n'), ['octo/repo/.github/workflows/x.yml@main']);
  assert.deepEqual(refs('on: push\r\njobs:\r\n  a:\r\n    steps:\r\n      - uses: actions/checkout@v4\r\n'), [
    'actions/checkout@v4',
  ]);
});

test('anchored steps and composite action steps are read, with the line of the uses value', () => {
  const anchored = `jobs:\n  a:\n    steps:\n      - &setup\n        uses: actions/setup-node@v4\n  b:\n    steps:\n      - *setup\n      - uses: actions/checkout@${sha}\n`;
  assert.deepEqual(findUnpinned(anchored), [
    { line: 5, ref: 'actions/setup-node@v4' },
    { line: 5, ref: 'actions/setup-node@v4' },
  ]);
  const composite = `runs:\n  using: composite\n  steps:\n    - uses: pnpm/action-setup@${sha}\n    - uses: actions/setup-node@v4\n`;
  assert.deepEqual(findUnpinned(composite), [{ line: 5, ref: 'actions/setup-node@v4' }]);
});

test('a merge key in a job or step fails, so it cannot hide a uses:', () => {
  const merged = 'x: &s {uses: actions/checkout@v4}\njobs:\n  a:\n    steps:\n      - <<: *s\n        name: m\n  b:\n    <<: *s\n';
  assert.deepEqual(findUnpinned(merged), [
    { line: 5, ref: '<< (merge key)' },
    { line: 8, ref: '<< (merge key)' },
  ]);
});

test('a job container or service image passes only when pinned to a digest', () => {
  const job = (body) => `jobs:\n  a:\n    runs-on: ubuntu-24.04\n${body}\n    steps:\n      - run: echo hi\n`;
  for (const body of [
    `    container: mcr.microsoft.com/playwright:v1.64.1-noble@${digest}`,
    `    container:\n      image: alpine@${digest}\n      options: --user 1001`,
    `    services:\n      db:\n        image: postgres:17@${digest}`,
  ]) {
    assert.deepEqual(refs(job(body)), [], body);
  }
  for (const [body, ref] of [
    ['    container: mcr.microsoft.com/playwright:v1.64.1-noble', 'mcr.microsoft.com/playwright:v1.64.1-noble'],
    ['    container:\n      image: alpine:3.20', 'alpine:3.20'],
    ['    container: ${{ matrix.image }}', '${{ matrix.image }}'],
    [`    container: alpine@sha256:${'0'.repeat(63)}`, `alpine@sha256:${'0'.repeat(63)}`],
    ['    services:\n      db:\n        image: postgres:17', 'postgres:17'],
    ['    services:\n      db: postgres:17', 'postgres:17'],
    ['    services: ${{ fromJSON(inputs.services) }}', '${{ fromJSON(inputs.services) }}'],
  ]) {
    assert.deepEqual(refs(job(body)), [ref], body);
  }
  assert.deepEqual(findUnpinned(job('    container: alpine:3.20')), [{ line: 4, ref: 'alpine:3.20' }]);
});

test('a file that is not YAML is reported, not skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pinned-actions-'));
  try {
    const file = join(dir, 'broken.yml');
    writeFileSync(file, 'jobs:\n  a: [\n');
    const [line] = scan([file]);
    assert.match(line, /broken\.yml: could not read it as YAML/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the repository pins every action, from any working directory', () => {
  const files = defaultFiles();
  assert.ok(files.some((file) => file.endsWith('ci.yml')));
  assert.ok(files.some((file) => file.endsWith('action.yml')));
  assert.deepEqual(scan(files), []);
  const run = spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('the command names each unpinned file and line and exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pinned-actions-'));
  try {
    const file = join(dir, 'ci.yml');
    writeFileSync(file, workflow('- uses: actions/checkout@v4'));
    const run = spawnSync(process.execPath, [script, file], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^ci\.yml:6: actions\/checkout@v4$/m);
    assert.match(run.stderr, /pinned-actions: pin each action above/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
