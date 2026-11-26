# 0016. Shared agent rules live in the home repo

- **Date:** 2026-11-16
- **Status:** Partly superseded by [0018](0018-drop-pstack-for-matt-skills.md), 2026-11-26: the pstack parts are struck; shared rules still live in home.
- **Source:** Ben's request to make todae's agent setup thin and consistent with [tounsoo/home](https://github.com/tounsoo/home), as the pilot for the other repos.

## Decision

`AGENTS.md` is the source of instructions that are specific to this repo: commands, architecture pointers, and the repo lines that fill in home's shared playbooks. Shared material is read from tounsoo/home, not copied: `standards/git.md`, `standards/pull-requests.md`, `playbooks/review-before-pr.md`, `playbooks/waiting-on-ci.md`, the memory split and the learnings ladder ~~, and the description of how each tool finds pstack~~.

`CLAUDE.md` imports `AGENTS.md` ~~and `.claude/pstack-models.md`. The model sheet's name is `.claude/pstack-models.md`~~.

`.agents/playbooks/` keeps the playbooks that are about this repo: `changesets.md`, `docs-translation.md` and `tokens.md`. ~~`.agents/pstack/check.sh` anchor-checks the playbooks in that directory. The review and CI overlays are home's files, so the check does not see their anchors.~~ Threads apply home's review and CI playbooks with the repo lines in `AGENTS.md`.

~~The pinned pstack copy in `.agents/pstack/` stays ([0015](0015-pinned-pstack-copy.md)). Threads stay on the commit in `.agents/pstack/pin.json`.~~ Cursor's verify skill and Claude's verify skill stay where they are.

## Why

The review, CI, git and pull request rules had a copy in this repo that drifted from the other repos. One copy in home is the source. This repo keeps the facts home cannot know: its commands and its CI job names ~~, and its pinned pstack~~.

## Amendment

- **Date:** 2026-11-26
- **Source:** Ben approved this amendment, the path check and its rule-table row on 2026-11-26 (through Mike), after the agent-legibility review found this decision still Active and still naming pstack paths that #511 to #514 took out.

[0018](0018-drop-pstack-for-matt-skills.md) replaced pstack with Matt Pocock's skills, so the struck text no longer applies: the model sheet, the pinned copy, its pin and its anchor check are gone. `AGENTS.md` is still the source of the repo's own instructions, the shared rules are still read from home, and `.agents/playbooks/` still holds the three repo playbooks.
