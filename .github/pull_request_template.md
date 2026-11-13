## Why

<!-- The problem and the approach, in one to three sentences. -->

## What changed

<!-- One to three bullets. Name a path only when it carries the change. -->

## Scope

<!-- What this covers and what it leaves out on purpose. -->

## Verification

<!--
Replace the lines below with the output of `node .claude/skills/verify/verify.mjs body`, or fill them by hand.
The tested commit is the full SHA the commands ran on. A push after the run needs a new run.
List every command with its result: passed, failed, or blocked with the reason.
-->

Tested commit: `<40-character SHA>`
Base: `<merge base with main>`
Verdict: <PASS, FAIL or BLOCKED>

- `<command>`: <result>

## Unverified checks

<!-- Each check that didn't run or ended BLOCKED, with the reason. Write "None" only when that is true. -->

## Remaining risks

<!-- What could still break, and for whom. Write "None" only when that is true. -->

<!--
Also, when it applies:
- A user-facing change has a changeset, or `pnpm changeset --empty` when it ships nothing.
- A changed decision or spec edits its file in docs/decisions/.
- A new docs page, docs section or check changes CLAUDE.md and .claude/skills/verify/, or the body says why on its own line, starting with "Agent docs unchanged:" and a reason.
-->
