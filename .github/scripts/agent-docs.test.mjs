import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Runs .github/scripts/agent-docs.mjs against small repositories: a base commit on main, and a branch with the
// pull request's changes.

const script = fileURLToPath(new URL('./agent-docs.mjs', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'agent-docs-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const gitConfig = join(scratch, 'gitconfig');
writeFileSync(gitConfig, '[user]\n\tname = test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n');
const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1' };
delete env.PR_BODY;

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
};

const write = (dir, files) => {
  for (const [path, text] of Object.entries(files)) {
    if (text === null) {
      rmSync(join(dir, path));
      continue;
    }
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
};

const ci = (steps, jobs = '') =>
  `on:\n  pull_request:\njobs:\n  static:\n    runs-on: ubuntu-24.04\n    steps:\n      - uses: actions/checkout@v4\n${steps}${jobs}`;

const siteGroups = (...ids) =>
  `export const SITE_GROUPS = [\n${ids.map((id) => `  {\n    id: '${id}',\n    links: [],\n  },\n`).join('')}] as const;\n\nexport const LINKS = [\n  {\n    id: 'not-a-section',\n  },\n];\n`;

const base = {
  'CLAUDE.md': '# Claude\n',
  '.claude/skills/verify/SKILL.md': '# Verify\n',
  'package.json': JSON.stringify({ scripts: { check: 'pnpm lint && pnpm typecheck' } }),
  '.github/workflows/ci.yml': ci('      - name: Lint\n        run: pnpm lint\n'),
  '.github/workflows/release.yml': 'on:\n  push:\njobs:\n  publish:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm publish\n',
  'apps/docs/components/siteGroups.ts': siteGroups('foundations', 'components'),
  'apps/docs/app/(en)/page.tsx': 'export default function Home() {}\n',
  'apps/docs/app/(en)/button/page.mdx': '# Button\n\nA button does a thing when pressed.\n',
  'apps/docs/app/ko/button/page.mdx': '# 버튼\n',
};

let count = 0;
// Commits base on main, then changes on a branch, and runs the check with the branch as head.
function check(changes, body) {
  const dir = join(scratch, `repo-${count++}`);
  mkdirSync(dir);
  git(dir, 'init', '-q');
  write(dir, base);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'checkout', '-qb', 'pr');
  write(dir, changes);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'change', '--allow-empty');
  const result = spawnSync(process.execPath, [script, 'main', 'pr'], {
    cwd: dir,
    env: body === undefined ? env : { ...env, PR_BODY: body },
    encoding: 'utf8',
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

const agentDocs = { 'CLAUDE.md': '# Claude\n\nMore.\n', '.claude/skills/verify/SKILL.md': '# Verify\n\nMore.\n' };

test('a change that adds nothing new passes', () => {
  const result = check({ 'apps/docs/app/(en)/button/page.mdx': '# Button\n\nChanged.\n', 'src/a.ts': 'x\n' });
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /adds no docs page, docs section or check/);
});

test('a new docs page fails without CLAUDE.md and the verify skill', () => {
  const result = check({ 'apps/docs/app/(en)/recipes/kanban/page.mdx': '# Kanban\n', 'apps/docs/app/ko/recipes/kanban/page.mdx': '# 칸반\n' });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /docs page \/recipes\/kanban/);
  assert.match(result.out, /change CLAUDE\.md and the verify skill/);
});

test('a page in a route group counts by its route', () => {
  const result = check({ 'apps/docs/app/(en)/(guides)/start/page.tsx': 'x\n' });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /docs page \/start\n/);
});

test('a Korean page alone, or a file beside a page, is not a new page', () => {
  const result = check({ 'apps/docs/app/ko/new/page.mdx': '# 새\n', 'apps/docs/app/(en)/button/Demo.tsx': 'x\n' });
  assert.equal(result.status, 0, result.out);
});

test('a page that moves is not a new page, however much it changes', () => {
  const result = check({
    'apps/docs/app/(en)/button/page.mdx': null,
    'apps/docs/app/(en)/actions/button/page.mdx': '# Actions\n\nEverything here is new text about something else.\n',
  });
  assert.equal(result.status, 0, result.out);
});

test('more new routes than removed ones count every new route', () => {
  const result = check({
    'apps/docs/app/(en)/button/page.mdx': null,
    'apps/docs/app/(en)/actions/button/page.mdx': '# Button\n',
    'apps/docs/app/(en)/actions/link/page.mdx': '# Link\n',
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /docs page \/actions\/button\n {2}- docs page \/actions\/link/);
});

test('a page.mdx that becomes a page.tsx keeps its route', () => {
  const result = check({ 'apps/docs/app/(en)/button/page.mdx': null, 'apps/docs/app/(en)/button/page.tsx': 'export default 1;\n' });
  assert.equal(result.status, 0, result.out);
});

test('a new docs section fails, and an id outside the groups is not a section', () => {
  const result = check({
    'apps/docs/components/siteGroups.ts': siteGroups('foundations', 'components', 'recipes').replace('not-a-section', 'still-not'),
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /docs section recipes/);
  assert.doesNotMatch(result.out, /still-not/);
});

test('a new job or a new run step in a pull request workflow fails', () => {
  const result = check({
    '.github/workflows/ci.yml': ci(
      '      - name: Lint\n        run: pnpm lint\n      - name: Pinned actions\n        run: node pinned.mjs\n      - run: pnpm test:axe\n',
      '  docs:\n    runs-on: ubuntu-24.04\n    steps:\n      - uses: actions/checkout@v4\n',
    ),
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /check step "Pinned actions"/);
  assert.match(result.out, /check step `pnpm test:axe`/);
  assert.match(result.out, /check ci\.yml: job docs/);
});

test('a new workflow that pull requests start fails', () => {
  const result = check({
    '.github/workflows/links.yaml': 'on: [push, pull_request]\njobs:\n  links:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: lychee .\n',
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /check links\.yaml: job links/);
});

test('a step that only uses an action, a step copied into another job or workflow, or a push-only workflow is not a check', () => {
  const result = check({
    '.github/workflows/ci.yml': ci(
      '      - name: Lint\n        run: pnpm lint\n      - uses: actions/cache/save@v4\n',
      '  static:\n    runs-on: ubuntu-24.04\n    steps:\n      - name: Lint\n        run: pnpm lint\n',
    ).replace(/jobs:\n {2}static:/, 'jobs:\n  lint:'),
    '.github/workflows/lint.yml': 'on: pull_request\njobs:\n  static:\n    runs-on: ubuntu-24.04\n    steps:\n      - name: Lint\n        run: pnpm lint\n',
    '.github/workflows/release.yml': 'on:\n  push:\njobs:\n  publish:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm publish\n  tag:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: git tag v1\n',
  });
  assert.match(result.out, /check ci\.yml: job lint/);
  assert.match(result.out, /check lint\.yml: job static/);
  assert.doesNotMatch(result.out, /check step|release/);
});

test('a new part of pnpm check fails', () => {
  const result = check({ 'package.json': JSON.stringify({ scripts: { check: 'pnpm lint && pnpm typecheck && pnpm stylelint' } }) });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /`pnpm check` runs `pnpm stylelint`/);
});

test('a new page passes with CLAUDE.md and the verify skill changed', () => {
  const result = check({ 'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n', ...agentDocs });
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /changes CLAUDE\.md and the verify skill too/);
});

test('changing only one of the two still fails and names the other', () => {
  const onlyClaude = check({ 'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n', 'CLAUDE.md': '# Claude\n\nMore.\n' });
  assert.equal(onlyClaude.status, 1, onlyClaude.out);
  assert.match(onlyClaude.out, /change the verify skill \(\.claude\/skills\/verify\/SKILL\.md or verify\.mjs\)/);
  const onlyVerify = check({ 'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n', '.claude/skills/verify/verify.mjs': 'x\n' });
  assert.equal(onlyVerify.status, 1, onlyVerify.out);
  assert.match(onlyVerify.out, /change CLAUDE\.md in this pull request/);
});

test('deleting CLAUDE.md, or changing only the verify tests, is not changing the agent docs', () => {
  const result = check({
    'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n',
    'CLAUDE.md': null,
    '.claude/skills/verify/verify.test.mjs': 'x\n',
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /change CLAUDE\.md and the verify skill/);
});

test('a workflow that is not valid YAML fails with its name', () => {
  const result = check({ '.github/workflows/ci.yml': 'on: [\n' });
  assert.notEqual(result.status, 0);
  assert.match(result.out, /\.github\/workflows\/ci\.yml is not valid YAML/);
});

test('a SITE_GROUPS that the script cannot read fails rather than hide new sections', () => {
  const result = check({
    'apps/docs/components/siteGroups.ts': siteGroups('foundations', 'components').replace('SITE_GROUPS = [', 'SITE_GROUPS: readonly Group[] = ['),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.out, /siteGroups\.ts has no group ids where agent-docs\.mjs looks for them/);
});

test('a long unnamed step shows its first line', () => {
  const result = check({ '.github/workflows/ci.yml': ci('      - name: Lint\n        run: pnpm lint\n      - run: |\n          pnpm a\n          pnpm b\n') });
  assert.match(result.out, /check step `pnpm a …`\n/);
  assert.doesNotMatch(result.out, /pnpm b/);
});

test('a body line with a reason lets it pass, and one without a reason does not', () => {
  const page = { 'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n' };
  const passed = check(page, '## Why\n\nA recipe.\n\nAgent docs unchanged: verify drives new routes from the diff\n');
  assert.equal(passed.status, 0, passed.out);
  assert.match(passed.out, /stay as they are: verify drives new routes from the diff$/m);
  assert.doesNotMatch(passed.out, /PR_BODY/);
  const crlf = check(page, '## Why\r\n\r\nAgent docs unchanged: a recipe\r\n');
  assert.match(crlf.out, /stay as they are: a recipe\n/);
  assert.equal(check(page, 'Agent docs unchanged:   \r\n').status, 1);
  assert.equal(check(page, 'We left the agent docs unchanged: no reason\n').status, 1);
  assert.equal(check(page, 'Agent docs unchanged: <reason>\n').status, 1);
  assert.equal(check(page, '<!--\nAgent docs unchanged: hidden from the page\n-->\n').status, 1);
  assert.equal(check(page, '<!-- a note -->\nAgent docs unchanged: shown on the page\n').status, 0);
  assert.match(check(page).out, /For a run outside CI, set PR_BODY to that body\./);
});

test('the body line counts as a list item or quote, after a placeholder, and not in a code block', () => {
  const page = { 'apps/docs/app/(en)/kanban/page.mdx': '# Kanban\n' };
  assert.equal(check(page, '- Agent docs unchanged: a recipe\n').status, 0);
  assert.equal(check(page, '> Agent docs unchanged: a recipe\n').status, 0);
  const second = check(page, 'Agent docs unchanged: <reason>\nAgent docs unchanged: a recipe\n');
  assert.match(second.out, /stay as they are: a recipe\n/);
  assert.equal(check(page, 'Agent docs unchanged: `<reason>`\n').status, 1);
  assert.equal(check(page, '```\nAgent docs unchanged: quoted rule\n```\n').status, 1);
  assert.equal(check(page, '~~~md\nAgent docs unchanged: quoted rule\n').status, 1);
  assert.equal(check(page, '```\nx\n```\nAgent docs unchanged: after the block\n').status, 0);
});
