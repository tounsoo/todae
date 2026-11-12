import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Runs .github/scripts/pstack-update.sh, .agents/pstack/update.sh and .agents/pstack/check.sh against local
// repositories: a stand-in for pstack-claude, a small todae as origin, and a fake gh that serves pull requests.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'pstack-update-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const gitConfig = join(scratch, 'gitconfig');
writeFileSync(gitConfig, '[user]\n\tname = test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n');
const baseEnv = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1' };
delete baseEnv.GITHUB_OUTPUT;
delete baseEnv.GITHUB_STEP_SUMMARY;

let count = 0;
const fresh = (name) => {
  const dir = join(scratch, `${name}-${count++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const run = (cmd, args, cwd, env = {}) => {
  const result = spawnSync(cmd, args, { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8' });
  return { status: result.status, out: `${result.stdout}${result.stderr}`, stdout: result.stdout };
};
const git = (cwd, ...args) => {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.out}`);
  return result.stdout.trim();
};
const write = (dir, files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
};

// The scripts run from copies, as the workflow runs them.
const tools = fresh('tools');
for (const [from, to] of [
  ['.github/scripts/pstack-update.sh', 'pstack-update.sh'],
  ['.agents/pstack/update.sh', 'update.sh'],
  ['.agents/pstack/check.sh', 'check.sh'],
  ['.github/scripts/pstack-upstream.sh', 'pstack-upstream.sh'],
]) {
  copyFileSync(join(root, from), join(tools, to));
}
const ghLog = join(scratch, 'gh.log');
const ghPrs = join(scratch, 'gh-prs.json');
const bin = fresh('bin');
// It keeps only the pull requests in the state asked for, as GitHub does, and says OPEN for any it is asked about.
writeFileSync(
  join(bin, 'gh'),
  [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> '${ghLog}'`,
    'case "$*" in',
    `  "pr list "*"--state open"*) jq '[.[] | select(.state == "OPEN")]' '${ghPrs}' ;;`,
    `  "pr list "*"--state closed"*) jq '[.[] | select(.state != "OPEN")]' '${ghPrs}' ;;`,
    '  "pr view "*) echo "${GH_PR_STATE:-OPEN}" ;;',
    '  "pr create "*) echo https://example.test/pull/9 ;;',
    'esac',
    '',
  ].join('\n'),
);
chmodSync(join(bin, 'gh'), 0o755);

const pstackFiles = {
  'plugins/pstack/skills/poteto-mode/SKILL.md': 'poteto-mode\n',
  'plugins/pstack/skills/poteto-mode/playbooks/base.md': '# Base\n\n1. Step one.\n',
  'plugins/pstack/skills/poteto-mode/references/licenses/LICENSE': 'MIT\n',
  'plugins/pstack/agents/poteto-agent.md': 'agent\n',
  'plugins/pstack/agents/comment-sicko.md': 'agent\n',
  'plugins/pstack/agents/thermo-nuclear-review-subagent.md': 'agent\n',
  'plugins/pstack/agents/thermo-nuclear-code-quality-review-subagent.md': 'agent\n',
  'plugins/pstack/old/thing.md': 'dropped later\n',
};

// A stand-in for pstack-claude: A, then B (drops old/, adds files todae's .gitignore matches), then C.
const upstream = () => {
  const dir = fresh('upstream');
  git(dir, 'init', '-q');
  write(dir, pstackFiles);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'A');
  const a = git(dir, 'rev-parse', 'HEAD');
  return {
    dir,
    a,
    step(name, change) {
      change(dir);
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', name);
      return git(dir, 'rev-parse', 'HEAD');
    },
  };
};
const toB = (dir) => {
  rmSync(join(dir, 'plugins/pstack/old'), { recursive: true });
  write(dir, {
    'plugins/pstack/dist/index.js': 'built\n',
    'plugins/pstack/notes.log': 'log\n',
    'plugins/pstack/.hidden/x.md': 'hidden\n',
    'plugins/pstack/skills/poteto-mode/SKILL.md': 'poteto-mode\n\nReviewer: fable\n',
  });
};

// A small todae at upstream's A, pushed to a bare origin, and a checkout of it.
const todae = (up) => {
  const work = fresh('todae');
  const origin = fresh('origin');
  git(origin, 'init', '-q', '--bare');
  git(work, 'init', '-q');
  write(work, {
    '.gitignore': 'dist\n*.log\n',
    '.agents/playbooks/x.md': '---\nwhen: always\nextends: base\n---\n\n- **After** "Step one." add: step two.\n',
    '.agents/pstack/pin.json': '{}\n',
  });
  const update = run('sh', [join(tools, 'update.sh'), up.a], work, { PSTACK_REPO: up.dir });
  assert.equal(update.status, 0, update.out);
  git(work, 'add', '-A', '-f');
  git(work, 'commit', '-q', '-m', 'todae');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  return { origin, clone: () => {
    const dir = fresh('checkout');
    git(dir, 'clone', '-q', origin, '.');
    return dir;
  } };
};

const step = (name, cwd, up, prs, env = {}) => {
  const output = join(fresh('output'), 'out');
  writeFileSync(output, '');
  writeFileSync(ghPrs, JSON.stringify(prs));
  writeFileSync(ghLog, '');
  const body = join(scratch, `body-${count++}.md`);
  const result = run('bash', [join(tools, 'pstack-update.sh'), name], cwd, {
    PATH: `${bin}:${process.env.PATH}`,
    REPO: 'tounsoo/todae',
    BASE: 'main',
    TOOLS: tools,
    BODY: body,
    GITHUB_OUTPUT: output,
    PSTACK_REPO: up.dir,
    GH_TOKEN: 'unused',
    ...env,
  });
  const outputs = Object.fromEntries(
    readFileSync(output, 'utf8').split('\n').filter(Boolean).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  const read = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
  return { ...result, outputs, body: read(body), bodyPath: body, gh: read(ghLog) };
};
const publish = (cwd, up, origin, prepared) => step('publish', cwd, up, [], {
  PUSH_URL: origin,
  OPEN: prepared.outputs.open,
  BRANCH: prepared.outputs.branch,
  TITLE: prepared.outputs.title,
  BODY: prepared.bodyPath,
});
const pr = (fields) => ({ number: 1, state: 'OPEN', title: 'x', headRefName: 'pstack-update/x', isCrossRepository: false, mergedAt: null, ...fields });

test('a current copy opens nothing', () => {
  const up = upstream();
  const repo = todae(up);
  const result = step('prepare', repo.clone(), up, []);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'false');
  assert.match(result.out, /is the copy main already has/);
});

test('an upstream commit that leaves plugins/pstack as it was opens nothing', () => {
  const up = upstream();
  const repo = todae(up);
  up.step('readme', (dir) => write(dir, { 'README.md': 'upstream readme\n' }));
  const result = step('prepare', repo.clone(), up, []);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'false');
  assert.match(result.out, /already has, so there is nothing to update/);
});

test('an open pull request is left alone when upstream moves outside plugins/pstack', () => {
  const up = upstream();
  const repo = todae(up);
  up.step('B', toB);
  const first = repo.clone();
  const opened = step('prepare', first, up, []);
  assert.equal(publish(first, up, repo.origin, opened).status, 0);
  up.step('readme', (dir) => write(dir, { 'README.md': 'upstream readme\n' }));
  const result = step('prepare', repo.clone(), up, [pr({ number: 12, headRefName: opened.outputs.branch })]);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'false');
  assert.match(result.out, /is the copy pull request #12 already has/);
});

test('a new upstream commit is copied word for word onto a new branch and opens a pull request', () => {
  const up = upstream();
  const repo = todae(up);
  const b = up.step('B', toB);
  const work = repo.clone();
  const result = step('prepare', work, up, []);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'true');
  assert.equal(result.outputs.open, '');
  assert.equal(result.outputs.branch, `pstack-update/${b.slice(0, 7)}`);
  const files = git(work, 'ls-files', '.agents/pstack/plugin').split('\n');
  for (const kept of ['dist/index.js', 'notes.log', '.hidden/x.md']) assert.ok(files.includes(`.agents/pstack/plugin/${kept}`), kept);
  assert.ok(!files.includes('.agents/pstack/plugin/old/thing.md'));
  const pin = JSON.parse(readFileSync(join(work, '.agents/pstack/pin.json'), 'utf8'));
  assert.equal(pin.commit, b);
  assert.equal(pin.tree, git(up.dir, 'rev-parse', `${b}:plugins/pstack`));
  assert.equal(pin.tree, git(work, 'rev-parse', 'HEAD:.agents/pstack/plugin'));
  assert.match(result.body, /Verdict: PASS/);
  assert.ok(result.body.includes(`compare/${up.a}...${b}`));
  assert.match(result.body, /Files upstream removed \(1\):\n\n- `old\/thing.md`/);
  assert.match(result.body, /name Fable[^\n]*\n\n- `skills\/poteto-mode\/SKILL.md`/);
  assert.match(result.body, /Only the pinned copy and its pin/);

  const pushed = publish(work, up, repo.origin, result);
  assert.equal(pushed.status, 0, pushed.out);
  assert.match(pushed.gh, /^pr create --repo tounsoo\/todae --base main --head pstack-update\//m);
  assert.equal(git(repo.origin, 'rev-parse', `refs/heads/${result.outputs.branch}`), git(work, 'rev-parse', 'HEAD'));
});

test('the open pull request takes the next commit, with the base merged in and nothing rewritten', () => {
  const up = upstream();
  const repo = todae(up);
  const b = up.step('B', toB);
  const first = repo.clone();
  const opened = step('prepare', first, up, []);
  assert.equal(publish(first, up, repo.origin, opened).status, 0);
  const branchHead = git(repo.origin, 'rev-parse', `refs/heads/${opened.outputs.branch}`);

  // main moves on, and so does upstream.
  git(first, 'switch', '-q', 'main');
  write(first, { 'README.md': 'readme\n' });
  git(first, 'add', 'README.md');
  git(first, 'commit', '-q', '-m', 'readme');
  git(first, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  const c = up.step('C', (dir) => write(dir, { 'plugins/pstack/new.md': 'new\n' }));

  const work = repo.clone();
  const open = [pr({ number: 9, title: opened.outputs.title, headRefName: opened.outputs.branch })];
  const result = step('prepare', work, up, open);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'true');
  assert.equal(result.outputs.open, '9');
  assert.equal(result.outputs.branch, `pstack-update/${b.slice(0, 7)}`);
  // The compare link starts at main's pin, not at the branch's earlier update.
  assert.ok(result.body.includes(`compare/${up.a}...${c}`));
  assert.match(result.body, /Only the pinned copy and its pin/);

  const pushed = publish(work, up, repo.origin, result);
  assert.equal(pushed.status, 0, pushed.out);
  assert.match(pushed.gh, /^pr edit 9 /m);
  git(repo.origin, 'merge-base', '--is-ancestor', branchHead, `refs/heads/${opened.outputs.branch}`);
});

test("a fork's pull requests on a pstack-update branch are ignored", () => {
  const up = upstream();
  const repo = todae(up);
  const b = up.step('B', toB);
  const result = step('prepare', repo.clone(), up, [
    pr({ number: 3, headRefName: 'pstack-update/evil', isCrossRepository: true }),
    pr({ number: 4, state: 'CLOSED', title: `update to ${b.slice(0, 7)}`, headRefName: 'pstack-update/evil', isCrossRepository: true }),
  ]);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'true');
  assert.equal(result.outputs.open, '');
});

test('a copy whose pull request was closed without merging opens nothing, at the next commit too', () => {
  const up = upstream();
  const repo = todae(up);
  const b = up.step('B', toB);
  const short = b.slice(0, 7);
  const tree = git(up.dir, 'rev-parse', `${b}:plugins/pstack`);
  const closed = [pr({ number: 5, state: 'CLOSED', title: `chore(pstack): update the pinned copy to ${short}`, headRefName: `pstack-update/${short}`, body: `records the new commit and its folder's tree id, \`${tree}\`.` })];
  const result = step('prepare', repo.clone(), up, closed);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'false');
  assert.match(result.out, /#5 proposed this copy .* closed without merging/);
  up.step('README', (dir) => write(dir, { 'README.md': 'readme\n' }));
  const later = step('prepare', repo.clone(), up, closed);
  assert.equal(later.status, 0, later.out);
  assert.equal(later.outputs.changed, 'false');
  assert.match(later.out, /#5 proposed this copy/);
  // Another copy is a new proposal.
  up.step('C', (dir) => write(dir, { 'plugins/pstack/agents/poteto-agent.md': 'agent, changed\n' }));
  const next = step('prepare', repo.clone(), up, closed);
  assert.equal(next.status, 0, next.out);
  assert.equal(next.outputs.changed, 'true');
});

test('with two update pull requests open, the run updates the lower one and warns', () => {
  const up = upstream();
  const repo = todae(up);
  up.step('B', toB);
  const first = repo.clone();
  const opened = step('prepare', first, up, []);
  git(first, 'push', '-q', 'origin', `HEAD:refs/heads/${opened.outputs.branch}`);
  const result = step('prepare', repo.clone(), up, [
    pr({ number: 8, headRefName: 'pstack-update/later' }),
    pr({ number: 7, headRefName: opened.outputs.branch }),
  ]);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.open, '7');
  assert.match(result.out, /::warning::More than one .* updates #7 only/);
});

test('a branch pushed by a run that failed to open its pull request gets one', () => {
  const up = upstream();
  const repo = todae(up);
  up.step('B', toB);
  const first = repo.clone();
  const opened = step('prepare', first, up, []);
  git(first, 'push', '-q', 'origin', `HEAD:refs/heads/${opened.outputs.branch}`);
  const work = repo.clone();
  const result = step('prepare', work, up, []);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'true');
  assert.equal(result.outputs.branch, opened.outputs.branch);
  assert.equal(git(work, 'rev-parse', 'HEAD'), git(first, 'rev-parse', 'HEAD'));
  const pushed = publish(work, up, repo.origin, result);
  assert.equal(pushed.status, 0, pushed.out);
  assert.match(pushed.gh, /^pr create /m);
});

test('the lookups ask GitHub for open pull requests, and for closed ones by the copy, and the body names it', () => {
  const up = upstream();
  const repo = todae(up);
  const b = up.step('B', toB);
  const tree = git(up.dir, 'rev-parse', `${b}:plugins/pstack`);
  const result = step('prepare', repo.clone(), up, []);
  assert.equal(result.status, 0, result.out);
  assert.match(result.gh, /^pr list .*--state open/m);
  assert.ok(result.gh.split('\n').some((line) => line.includes('--state closed') && line.includes(`--search ${tree} in:body`)), result.gh);
  assert.ok(result.body.includes(`tree id, \`${tree}\``), result.body);
});

test('a pull request closed while the run prepared gets no push', () => {
  const up = upstream();
  const repo = todae(up);
  up.step('B', toB);
  const first = repo.clone();
  const opened = step('prepare', first, up, []);
  assert.equal(publish(first, up, repo.origin, opened).status, 0);
  up.step('C', (dir) => write(dir, { 'plugins/pstack/new.md': 'new\n' }));
  const work = repo.clone();
  const result = step('prepare', work, up, [pr({ number: 9, headRefName: opened.outputs.branch })]);
  assert.equal(result.outputs.changed, 'true');
  const before = git(repo.origin, 'rev-parse', `refs/heads/${opened.outputs.branch}`);
  const pushed = step('publish', work, up, [], {
    PUSH_URL: repo.origin, OPEN: '9', BRANCH: result.outputs.branch, TITLE: result.outputs.title, BODY: result.bodyPath, GH_PR_STATE: 'MERGED',
  });
  assert.equal(pushed.status, 0, pushed.out);
  assert.match(pushed.out, /closed while this run prepared/);
  assert.doesNotMatch(pushed.gh, /pr edit/);
  assert.equal(git(repo.origin, 'rev-parse', `refs/heads/${opened.outputs.branch}`), before);
});

test('update.sh copies nothing from a commit with a link, without a license or by a short name', () => {
  const up = upstream();
  const repo = todae(up);
  const work = repo.clone();
  const linked = up.step('link', (dir) => symlinkSync('/etc/passwd', join(dir, 'plugins/pstack/passwd')));
  const unlicensed = up.step('no license', (dir) => {
    rmSync(join(dir, 'plugins/pstack/passwd'));
    rmSync(join(dir, 'plugins/pstack/skills/poteto-mode/references/licenses'), { recursive: true });
  });
  const before = git(work, 'rev-parse', 'HEAD:.agents/pstack/plugin');
  for (const [commit, message] of [
    [linked, /links or submodules/],
    [unlicensed, /ships no LICENSE/],
    [linked.slice(0, 7), /not a full commit SHA/],
  ]) {
    const result = run('sh', [join(tools, 'update.sh'), commit], work, { PSTACK_REPO: up.dir });
    assert.notEqual(result.status, 0);
    assert.match(result.out, message);
  }
  assert.equal(git(work, 'status', '--porcelain', '--ignored', '--', '.agents/pstack'), '');
  assert.equal(git(work, 'rev-parse', 'HEAD:.agents/pstack/plugin'), before);
});

test('check.sh fails on a committed copy that differs from upstream, and on a broken anchor', () => {
  const up = upstream();
  const repo = todae(up);
  const work = repo.clone();
  assert.equal(run('sh', [join(tools, 'check.sh')], work).status, 0);

  write(work, { '.agents/playbooks/x.md': '---\nwhen: always\nextends: base\n---\n\n- **After** "Step nine." add: x.\n' });
  const anchor = run('sh', [join(tools, 'check.sh')], work);
  assert.equal(anchor.status, 1);
  assert.match(anchor.out, /"Step nine\." is not in any playbook it extends/);
  git(work, 'checkout', '--', '.agents/playbooks/x.md');

  write(work, { '.agents/pstack/plugin/agents/poteto-agent.md': 'edited\n' });
  const dirty = run('sh', [join(tools, 'check.sh')], work);
  assert.equal(dirty.status, 1);
  assert.match(dirty.out, /uncommitted changes/);
  write(work, { '.agents/pstack/plugin/dist/extra.js': 'ignored by .gitignore\n' });
  git(work, 'stash', '-q');
  const ignored = run('sh', [join(tools, 'check.sh')], work);
  assert.equal(ignored.status, 1);
  assert.match(ignored.out, /extra files, ignored ones included/);
  rmSync(join(work, '.agents/pstack/plugin/dist'), { recursive: true });
  git(work, 'stash', 'pop', '-q');
  git(work, 'commit', '-q', '-am', 'hand edit');
  const edited = run('sh', [join(tools, 'check.sh')], work);
  assert.equal(edited.status, 1);
  assert.match(edited.out, /isn't the one pin.json records/);

  write(work, { '.agents/pstack/pin.json': `{\n  "commit": "${up.a}"\n}\n` });
  const untreed = run('sh', [join(tools, 'check.sh')], work);
  assert.equal(untreed.status, 1);
  assert.match(untreed.out, /has no tree id/);
});

test('pstack-upstream.sh holds a changed pin to the tree upstream has at its commit', () => {
  const up = upstream();
  const repo = todae(up);
  const work = repo.clone();
  const base = git(work, 'rev-parse', 'HEAD');
  const check = () => run('bash', [join(tools, 'pstack-upstream.sh'), base], work, { PSTACK_REPO: up.dir });
  assert.match(check().out, /unchanged/);

  // A real update passes.
  const b = up.step('B', toB);
  assert.equal(run('sh', [join(tools, 'update.sh'), b], work, { PSTACK_REPO: up.dir }).status, 0);
  git(work, 'commit', '-q', '-am', 'update');
  const updated = check();
  assert.equal(updated.status, 0, updated.out);
  assert.match(updated.out, /matches upstream/);

  // A hand edit with its own tree id written into pin.json fails.
  write(work, { '.agents/pstack/plugin/agents/poteto-agent.md': 'edited\n' });
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'edit');
  const forged = JSON.parse(readFileSync(join(work, '.agents/pstack/pin.json'), 'utf8'));
  forged.tree = git(work, 'rev-parse', 'HEAD:.agents/pstack/plugin');
  writeFileSync(join(work, '.agents/pstack/pin.json'), JSON.stringify(forged, null, 2));
  git(work, 'commit', '-q', '-am', 'forged pin');
  assert.equal(run('sh', [join(tools, 'check.sh')], work).status, 0);
  const caught = check();
  assert.equal(caught.status, 1);
  assert.match(caught.out, /Only the pstack update workflow should change the copy/);

  // A commit off upstream's default branch, as a fork's would be, fails even with its real tree.
  git(up.dir, 'switch', '-q', '-c', 'side');
  const side = up.step('side', (dir) => write(dir, { 'plugins/pstack/side.md': 'side\n' }));
  git(up.dir, 'switch', '-q', '-');
  assert.equal(run('sh', [join(tools, 'update.sh'), side], work, { PSTACK_REPO: up.dir }).status, 0);
  git(work, 'commit', '-q', '-am', 'side pin');
  const offBranch = check();
  assert.equal(offBranch.status, 1);
  assert.match(offBranch.out, /isn't on pstack-claude's default branch/);
});

test('a restored copy pinned at upstream\'s newest commit, but not its tree, is still replaced', () => {
  const up = upstream();
  const repo = todae(up);
  const first = repo.clone();
  write(first, { '.agents/pstack/plugin/extra.md': 'restored by hand\n' });
  git(first, 'add', '-A');
  const pin = JSON.parse(readFileSync(join(first, '.agents/pstack/pin.json'), 'utf8'));
  git(first, 'commit', '-q', '-m', 'restored');
  pin.tree = git(first, 'rev-parse', 'HEAD:.agents/pstack/plugin');
  writeFileSync(join(first, '.agents/pstack/pin.json'), JSON.stringify(pin, null, 2));
  git(first, 'commit', '-q', '-am', 'pin restored copy');
  git(first, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  const work = repo.clone();
  const result = step('prepare', work, up, []);
  assert.equal(result.status, 0, result.out);
  assert.equal(result.outputs.changed, 'true');
  assert.match(result.body, /Files upstream removed \(1\):\n\n- `extra.md`/);
});
