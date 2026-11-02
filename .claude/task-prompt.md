# Task prompt template

Use this template for every brief that starts work on todae: the brief that starts a Duet thread, and the brief a thread gives a subagent. The reader knows only what the brief says, so fill each part or write "None". Delete the comments.

A subagent brief keeps the Rules part word for word, because a subagent doesn't read `CLAUDE.md` or `.claude/thread-start.md`.

```md
## Goal

<!-- Ben's words for what he wants, quoted, then one sentence on the problem it solves. -->

## Setup

Repo tounsoo/todae. Read `CLAUDE.md`, then follow `AGENTS.md` and `.claude/thread-start.md` before anything else.
<!-- For a subagent: the absolute path of the checkout or worktree, the branch, and the base commit it builds on. -->

## Scope

- In: <!-- the change, as files, behaviors, or a pull request number -->
- Out: <!-- what to leave alone, such as `.cursor/` -->
- Already done: <!-- what an earlier thread or pull request settled, so it isn't redone -->

## Done when

<!--
The result Ben can check. For a code change, name the change type from
`.claude/skills/verify/SKILL.md` and say that the verify run on the final commit ends PASS,
or that each BLOCKED step is listed under Unverified checks.
-->

## Rules

- One pull request for this task. Its body follows `.github/pull_request_template.md`.
- Changes to `.claude/`, `.agents/` and `CLAUDE.md` need Ben's yes.
- Agents don't merge. Report the pull request link with the verdict and wait for Ben.
- No force-push or rebase without Ben's yes.
- Don't change a design token without Ben's approval.
- Use the GitHub MCP tools, not `gh`.
<!-- For a subagent, add: Don't open, push to, comment on, or mark a pull request. Commit on your own branch and return. -->

## Report

<!--
What to send back. A thread reports the pull request link, the tested commit, the verdict, and any
question only Ben can answer. A subagent reports its commit SHA, the commands it ran with their
results, and what it couldn't do, with the reason.
-->
```
