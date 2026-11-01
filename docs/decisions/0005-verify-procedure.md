# 0005. Docs changes are checked with the verify procedure

- **Date:** 2026-11-01
- **Status:** Active
- **Source:** The verify skill added for the docs site. Amended 2026-11-01 for the `.claude/skills/verify/` pointer.

## Decision

A docs change is checked with the verify skill at `.cursor/skills/verify/SKILL.md`. The procedure has five steps. LAUNCH starts the docs app on port 3321, or opens the Vercel preview for the pull request head. DOCTOR requires a READY deployment whose `meta.githubCommitSha` is that head. The helper compares the SHA the operator read from that deployment with the head, labels the line caller-asserted, and checks that the routes return 200. It does not call the Vercel API. DRIVE opens the touched pages in English and Korean at 1280 and 390 CSS pixels wide, and checks the header links and the home group counts from `SITE_GROUPS`. EVIDENCE matches the change. A UI change needs screenshots at both widths in both languages. A docs or text change needs the rendered text. A logic change needs test output. A CI or config change needs the run link. CLEANUP stops the server the run started and leaves the evidence in `.verify/evidence`.

The skill lives under `.cursor/skills/` because `.claude/` and `.agents/` stay unchanged, apart from one pointer. `.claude/skills/` is the pstack port.

`.claude/skills/verify/SKILL.md` is that pointer, added on 2026-11-01. `poteto-mode` looks for a project verify skill under `.claude/skills/verify/`, so the pointer sends Claude sessions to `.cursor/skills/verify/SKILL.md`. The procedure, the helper and the feature map stay in `.cursor/skills/verify/`, and only the frontmatter `description` is repeated. `maintain-verification-skill` and `create-verification-skill` expect a full skill under `.claude/skills/verify/`, so they work on `.cursor/skills/verify/` instead and never write over the pointer. `update-pstack.sh` removes only the paths listed in `.claude/pstack-files.txt`, so it leaves the pointer in place while upstream pstack ships no skill named `verify`.

Every pull request body has a Verification section, an Unverified checks section, and a Remaining risks section. `None` is allowed only when that is true. A pull request missing any of the three is not ready for review.

After a fix for a bug, a review finding, or a maintainer correction (not routine edits), run a short reflect. Run correct only when the same kind of mistake shows up a second time, then enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.

## Why

The docs site is the reader-facing check for a docs change, and a unit test does not show the header, the locale, or the preview SHA. One procedure keeps that check the same from one pull request to the next.
