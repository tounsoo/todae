# 0005. Docs changes are checked with the verify procedure

- **Date:** 2026-11-01
- **Status:** Active
- **Source:** The verify skill added for the docs site. Amended 2026-11-01 for the Claude copy at `.claude/skills/verify/`.

## Decision

A docs change is checked with the verify skill, at `.claude/skills/verify/SKILL.md` for Claude and `.cursor/skills/verify/SKILL.md` for Cursor. The procedure has five steps. LAUNCH starts the docs app on port 3321, or opens the Vercel preview for the pull request head. DOCTOR requires a READY deployment whose `meta.githubCommitSha` is that head. The helper compares the SHA the operator read from that deployment with the head, labels the line caller-asserted, and checks that the routes return 200. It does not call the Vercel API. DRIVE opens the touched pages in English and Korean at 1280 and 390 CSS pixels wide, and checks the header links and the home group counts from `SITE_GROUPS`. EVIDENCE matches the change. A UI change needs screenshots at both widths in both languages. A docs or text change needs the rendered text. A logic change needs test output. A CI or config change needs the run link. CLEANUP stops the server the run started and leaves the evidence in `.verify/evidence`.

The skill has two copies. `.cursor/skills/verify/` came first, because `.claude/` and `.agents/` stay unchanged and `.claude/skills/` is the pstack port. On 2026-11-01 Ben asked for a full copy at `.claude/skills/verify/`, tuned for Claude, because `poteto-mode` looks for a project verify skill there. It is the one exception to leaving `.claude/` unchanged.

`verify.mjs` and the `features/` files are shared. They match byte for byte, except that each copy names its own directory in its commands. `scripts/verify-skill-sync.mjs` checks this, and `pnpm check` runs it.

The two `SKILL.md` files differ on purpose. The Claude copy uses Claude Code's tools: the GitHub and Vercel MCP tools to read the head SHA and the deployment, Bash for the helper, and Read to look at the screenshots. It also cites evidence in the pull request's Verification section. Both copies must still describe the same five steps with the same rules: the allowed hosts, the SHA checks, the paths, locales and widths, the header and home checks, the evidence each kind of change needs, and what cleanup stops and keeps. A change to any of those, or to the shared files, is made in both copies in the same pull request.

`maintain-verification-skill` runs on both copies. `create-verification-skill` doesn't run in this repo, because the skill already exists. `update-pstack.sh` removes only the paths listed in `.claude/pstack-files.txt`, so it leaves the Claude copy in place while upstream pstack ships no skill named `verify`.

Every pull request body has a Verification section, an Unverified checks section, and a Remaining risks section. `None` is allowed only when that is true. A pull request missing any of the three is not ready for review.

After a fix for a bug, a review finding, or a maintainer correction (not routine edits), run a short reflect. Run correct only when the same kind of mistake shows up a second time, then enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.

## Why

The docs site is the reader-facing check for a docs change, and a unit test does not show the header, the locale, or the preview SHA. One procedure keeps that check the same from one pull request to the next.
