# Task prompt template

Use this template for every brief that starts work on todae: the brief that starts a Duet thread, and the brief a thread gives a subagent. The reader knows only what the brief says, so fill each part or write "None". Delete the comments, and keep every line that is not a comment.

A thread brief keeps the Rules part and drops Subagent rules. A subagent brief keeps both parts word for word, because a subagent doesn't read `CLAUDE.md` or `.claude/thread-start.md`, and its Subagent rules win where the two differ.

```md
## Goal

<!-- Ben's words for what he wants, quoted, then one sentence on the problem it solves. -->

## Setup

Repo tounsoo/todae. Read `AGENTS.md` first. It points at the shared rules in tounsoo/home. Then read `CLAUDE.md` and `.claude/thread-start.md`.
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

- One pull request for this task. Its body follows `.github/pull_request_template.md`. The repo lines are in `AGENTS.md`.
- Git follows tounsoo/home `standards/git.md`, as `AGENTS.md` says. Agents don't merge, force-push or rebase. Report the pull request link with the verdict and wait for Ben.
- Changes to `.claude/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`, and the `.claude/**` entry in `eslint.config.mjs` need Ben's yes.
- Don't change a design token without Ben's approval. Follow `.agents/playbooks/tokens.md`.
- Use the GitHub MCP tools, not `gh`.

## Subagent rules

- Don't open, push to, comment on, or mark a pull request, and don't subscribe to one. The thread that started you does every write to the pull request.
- Commit on your own worktree branch and return. Don't reset or rewrite any other branch.
- Report your commit SHA, not a pull request link.

## Report

<!--
What to send back. A thread reports the pull request link, the tested commit, the verdict, and any
question only Ben can answer. A subagent reports its commit SHA, the commands it ran with their
results, and what it couldn't do, with the reason.
-->
```
