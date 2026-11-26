# 0005. Docs changes are checked with the verify procedure

- **Date:** 2026-11-01
- **Status:** Partly superseded by [0018](0018-drop-pstack-for-matt-skills.md), 2026-11-26: the pstack parts are struck; the verify procedure and the pull request sections still stand.
- **Source:** The verify skill added for the docs site.

## Decision

Cursor checks a docs change with its verify skill at `.cursor/skills/verify/SKILL.md`. The procedure has five steps. LAUNCH starts the docs app on port 3321, or opens the Vercel preview for the pull request head. DOCTOR requires a READY deployment whose `meta.githubCommitSha` is that head. The helper compares the SHA the operator read from that deployment with the head, labels the line caller-asserted, and checks that the routes return 200. It does not call the Vercel API. DRIVE opens the touched pages in English and Korean at 1280 and 390 CSS pixels wide, and checks the header links and the home group counts from `SITE_GROUPS`. EVIDENCE matches the change. A UI change needs screenshots at both widths in both languages. A docs or text change needs the rendered text. A logic change needs test output. A CI or config change needs the run link. CLEANUP stops the server the run started and leaves the evidence in `.verify/evidence`.

The skill lives under `.cursor/skills/` because it is Cursor's. Claude verifies with its own skill at `.claude/skills/verify/` ([0007](0007-claude-verify-and-pr-template.md)), and `.claude/` and `.agents/` change only with Ben's yes. ~~pstack isn't in `.claude/skills/`: threads read the pinned copy in `.agents/pstack/` ([0015](0015-pinned-pstack-copy.md)).~~

Every pull request body has a Verification section, an Unverified checks section, and a Remaining risks section. Verification starts with the tested commit, the full SHA the checks ran on. `None` is allowed only when that is true. A pull request missing any of the three, or the tested commit, is not ready for review.

~~After a fix for a bug, a review finding, or a maintainer correction (not routine edits), run a short reflect. Run correct only when the same kind of mistake shows up a second time, then enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.~~

## Why

The docs site is the reader-facing check for a docs change, and a unit test does not show the header, the locale, or the preview SHA. One procedure keeps that check the same from one pull request to the next.

## Amendment

- **Date:** 2026-11-26
- **Source:** Ben approved the decision path check on 2026-11-26, after the agent-legibility review found this decision still Active and still naming pstack paths that #511 to #514 took out.

[0018](0018-drop-pstack-for-matt-skills.md) replaced pstack with Matt Pocock's skills, so the struck text no longer applies: threads read no pinned pstack copy, and the reflect and correct steps were pstack's. The verify procedure, Claude's own verify skill at `.claude/skills/verify/`, and the three pull request sections still stand.
