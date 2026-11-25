# Task prompt template

Use this template for every brief that starts work on todae: the brief that starts a T3 Code thread, and the brief a thread gives a subagent. The reader knows only what the brief says, so fill each part or write "None". Delete the comments, and keep every line that is not a comment.

A subagent brief also keeps Subagent rules word for word. A thread brief drops that part.

```md
# <Title>

## Why

<!-- Ben's words for what he wants, quoted, then one sentence on the problem it solves. -->

## Task

<!-- The change, as files, behaviors or a pull request number. Say what to leave alone, such as `.cursor/`, and what an earlier thread or pull request already settled. -->

- Repo: tounsoo/todae. Read `AGENTS.md` first, then `CLAUDE.md`.
- Base: `main`
- Branch: `t3/<slug>`
<!-- For a subagent: the absolute path of the checkout or worktree, and the base commit it builds on. -->

## Promised behaviors

<!--
A numbered list of results Ben can check. For a code change, name the change type from
`.claude/skills/verify/SKILL.md` and say that the verify run on the final commit ends PASS,
or that each BLOCKED step is listed under Unverified checks.
-->

1. <!-- behavior -->

## Rules

- One pull request for this task, opened ready for review into the base. Its body follows `.github/pull_request_template.md`. The repo lines are in `AGENTS.md`.
- Git follows tounsoo/home `standards/git.md`, as `AGENTS.md` says. Never merge, force-push or rebase pushed history. To bring in the base, merge `origin/main`. Mike merges only on Ben's word.
- `Checks` and `rule-checker` stay green. A Gemini 4 Neon review subagent reviews the pull request, for at most three rounds.
- Changes to `.claude/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`, and the `.claude/**` entry in `eslint.config.mjs` need Ben's yes.
- Don't change a design token without Ben's approval. Follow `.agents/playbooks/tokens.md`.
- `gh` and the GitHub MCP tools are both fine.

## Subagent rules

- Don't open, push to, comment on, or mark a pull request. The thread that started you does every write to the pull request.
- Commit on your own worktree branch and return. Don't reset or rewrite any other branch.
- Report your commit SHA, not a pull request link.

## Report

<!--
What to send back. A thread ends with one line: the pull request link, CI state at the head SHA,
and the review verdict, with the rounds and anything it couldn't do above it. A subagent reports its
commit SHA, the commands it ran with their results, and what it couldn't do, with the reason.
-->
```
