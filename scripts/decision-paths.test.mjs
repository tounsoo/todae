import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDecisions } from './decision-paths.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('checkDecisions on this checkout', () => {
  it('finds every repo path a live decision names', () => {
    assert.deepEqual(checkDecisions(repoRoot), []);
  });
});

// The real past mistake: 0005 and 0016 as they stood on main at 1f8537db, still Active after #511–#514 removed pstack.
// Copied verbatim so the case runs in a shallow CI checkout too.
const UNAMENDED_0005 =
  "# 0005. Docs changes are checked with the verify procedure\n\n- **Date:** 2026-11-01\n- **Status:** Active\n- **Source:** The verify skill added for the docs site.\n\n## Decision\n\nCursor checks a docs change with its verify skill at `.cursor/skills/verify/SKILL.md`. The procedure has five steps. LAUNCH starts the docs app on port 3321, or opens the Vercel preview for the pull request head. DOCTOR requires a READY deployment whose `meta.githubCommitSha` is that head. The helper compares the SHA the operator read from that deployment with the head, labels the line caller-asserted, and checks that the routes return 200. It does not call the Vercel API. DRIVE opens the touched pages in English and Korean at 1280 and 390 CSS pixels wide, and checks the header links and the home group counts from `SITE_GROUPS`. EVIDENCE matches the change. A UI change needs screenshots at both widths in both languages. A docs or text change needs the rendered text. A logic change needs test output. A CI or config change needs the run link. CLEANUP stops the server the run started and leaves the evidence in `.verify/evidence`.\n\nThe skill lives under `.cursor/skills/` because it is Cursor's. Claude verifies with its own skill at `.claude/skills/verify/` ([0007](0007-claude-verify-and-pr-template.md)), and `.claude/` and `.agents/` change only with Ben's yes. pstack isn't in `.claude/skills/`: threads read the pinned copy in `.agents/pstack/` ([0015](0015-pinned-pstack-copy.md)).\n\nEvery pull request body has a Verification section, an Unverified checks section, and a Remaining risks section. Verification starts with the tested commit, the full SHA the checks ran on. `None` is allowed only when that is true. A pull request missing any of the three, or the tested commit, is not ready for review.\n\nAfter a fix for a bug, a review finding, or a maintainer correction (not routine edits), run a short reflect. Run correct only when the same kind of mistake shows up a second time, then enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.\n\n## Why\n\nThe docs site is the reader-facing check for a docs change, and a unit test does not show the header, the locale, or the preview SHA. One procedure keeps that check the same from one pull request to the next.\n";
const UNAMENDED_0016 =
  "# 0016. Shared agent rules live in the home repo\n\n- **Date:** 2026-11-16\n- **Status:** Active\n- **Source:** Ben's request to make todae's agent setup thin and consistent with [tounsoo/home](https://github.com/tounsoo/home), as the pilot for the other repos.\n\n## Decision\n\n`AGENTS.md` is the source of instructions that are specific to this repo: commands, architecture pointers, and the repo lines that fill in home's shared playbooks. Shared material is read from tounsoo/home, not copied: `standards/git.md`, `standards/pull-requests.md`, `playbooks/review-before-pr.md`, `playbooks/waiting-on-ci.md`, the memory split, the learnings ladder, and the description of how each tool finds pstack.\n\n`CLAUDE.md` imports `AGENTS.md` and `.claude/pstack-models.md`. The model sheet's name is `.claude/pstack-models.md`.\n\n`.agents/playbooks/` keeps the playbooks that are about this repo: `changesets.md`, `docs-translation.md` and `tokens.md`. `.agents/pstack/check.sh` anchor-checks the playbooks in that directory. The review and CI overlays are home's files, so the check does not see their anchors. Threads still apply those overlays, with the repo lines in `AGENTS.md`.\n\nThe pinned pstack copy in `.agents/pstack/` stays ([0015](0015-pinned-pstack-copy.md)). Threads stay on the commit in `.agents/pstack/pin.json`. Cursor's verify skill and Claude's verify skill stay where they are.\n\n## Why\n\nThe review, CI, git and pull request rules had a copy in this repo that drifted from the other repos. One copy in home is the source. This repo keeps the facts home cannot know: its commands, its CI job names, and its pinned pstack.\n";

function tempRepo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'decisions-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(dir, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

function decision(status, body) {
  return [
    '# 0099. Sample',
    '',
    '- **Date:** 2026-11-26',
    `- **Status:** ${status}`,
    '- **Source:** Test.',
    '',
    '## Decision',
    '',
    body,
    '',
  ].join('\n');
}

const layout = {
  '.claude/skills/verify/SKILL.md': 'x\n',
  '.cursor/skills/verify/SKILL.md': 'x\n',
  '.agents/playbooks/tokens.md': 'x\n',
  'AGENTS.md': 'x\n',
  'CLAUDE.md': 'x\n',
  '.gitignore': '.verify/\n',
};

describe('checkDecisions', () => {
  it('fails on the unamended 0005 and 0016, naming the dead path, the file and the fix', () => {
    const root = tempRepo({
      ...layout,
      'docs/decisions/0005-verify-procedure.md': UNAMENDED_0005,
      'docs/decisions/0016-shared-agent-rules-live-in-home.md': UNAMENDED_0016,
      'docs/decisions/0007-claude-verify-and-pr-template.md': decision('Active', 'x'),
      'docs/decisions/0015-pinned-pstack-copy.md': decision('Superseded by [0018](0018-x.md), 2026-11-25', 'x'),
    });
    const problems = checkDecisions(root);
    const named = problems.map((problem) => /^(\S+):\d+: names `([^`]+)`/.exec(problem)?.slice(1).join(' '));
    assert.deepEqual(named, [
      'docs/decisions/0005-verify-procedure.md .agents/pstack/',
      'docs/decisions/0016-shared-agent-rules-live-in-home.md .claude/pstack-models.md',
      'docs/decisions/0016-shared-agent-rules-live-in-home.md .agents/pstack/check.sh',
      'docs/decisions/0016-shared-agent-rules-live-in-home.md .agents/pstack/',
      'docs/decisions/0016-shared-agent-rules-live-in-home.md .agents/pstack/pin.json',
    ]);
    for (const problem of problems) assert.match(problem, /Amend the decision.*or restore the file/);
  });

  it('fails when a new dead path lands in an Active or Partly superseded decision', () => {
    for (const status of ['Active', 'Partly superseded by [0018](0018-x.md), 2026-11-26: part still stands.']) {
      const root = tempRepo({
        ...layout,
        'docs/decisions/0099-sample.md': decision(
          status,
          'Threads read `.agents/gone/pin.json` and [the note](0098-missing.md).',
        ),
      });
      assert.deepEqual(
        checkDecisions(root).map((problem) => problem.split(', which')[0]),
        [
          'docs/decisions/0099-sample.md:9: names `.agents/gone/pin.json`',
          'docs/decisions/0099-sample.md:9: names `0098-missing.md`',
        ],
      );
    }
  });

  it('skips Superseded decisions, sentences that record a removal, and struck-through paths', () => {
    const root = tempRepo({
      ...layout,
      'docs/decisions/0098-old.md': decision(
        'Superseded by [0099](0099-sample.md), 2026-11-26',
        'Threads read `.agents/pstack/`.',
      ),
      'docs/decisions/0099-sample.md': decision(
        'Active',
        'The pinned copy in `.agents/pstack/` is removed. ~~Read `.claude/pstack-models.md`. Run `.agents/pstack/check.sh`.~~ Claude verifies with `.claude/skills/verify/` and [0098](0098-old.md).',
      ),
    });
    assert.deepEqual(checkDecisions(root), []);
  });

  it('does not treat commands, identifiers, branches, ignored output or home paths as repo paths', () => {
    const root = tempRepo({
      ...layout,
      'docs/decisions/0099-sample.md': decision(
        'Active',
        'Run `pnpm bench`, read `standards/git.md` in home, work on `t3/<slug>`, keep `.verify/evidence`, set `meta.githubCommitSha`, see [home](https://github.com/tounsoo/home) and [above](#why).',
      ),
    });
    assert.deepEqual(checkDecisions(root), []);
  });

  it('fails on a Status it cannot classify, and on an index entry whose status disagrees with the file', () => {
    const root = tempRepo({
      ...layout,
      'docs/decisions/0098-odd.md': decision('Maybe', 'x'),
      'docs/decisions/0099-sample.md': decision('Partly superseded by [0018](0018-x.md), 2026-11-26', 'x'),
      'docs/decisions/README.md': '- [0099. Sample](0099-sample.md). Active, 2026-11-26.\n',
    });
    const problems = checkDecisions(root);
    assert.equal(problems.length, 2);
    assert.match(
      problems[0] ?? '',
      /0098-odd\.md: Status "Maybe" does not start with Active, Partly superseded or Superseded/,
    );
    assert.match(
      problems[1] ?? '',
      /README\.md:1: lists 0099-sample\.md as "Active", but its Status is Partly superseded\. Write Partly superseded/,
    );
  });
});
