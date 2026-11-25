# 0018. Threads use Matt Pocock's skills in T3 Code, not pstack

- **Date:** 2026-11-25
- **Status:** Active
- **Source:** Ben, 2026-11-25: "Review repos to also match our new flow", and his approval the same day of the cleanup that removes pstack and edits the agent files.

## Decision

Coding on todae happens in T3 Code threads (Claude Code) on Ben's machine, each on a branch named `t3/<slug>`. A thread opens a pull request into `main` ready for review, gets `Checks` and `rule-checker` green, and has a Gemini 4 Neon review subagent review it, for at most three rounds. Mike, Ben's engineering lead bot, merges only on Ben's word. Threads never merge or force-push. Threads may use `gh` and the GitHub MCP tools.

Matt Pocock's skills (mattpocock-skills v1.3.2) replace pstack. A thread calls `mattpocock-skills:tdd`, `mattpocock-skills:diagnosing-bugs`, `mattpocock-skills:code-review` (not Claude Code's built-in `code-review`), `mattpocock-skills:pr`, `mattpocock-skills:prototype`, `mattpocock-skills:codebase-design`, `mattpocock-skills:grilling`, `mattpocock-skills:domain-modeling` and `mattpocock-skills:research`. Ben or Mike types `/mattpocock-skills:<name>` for `grill-with-docs`, `to-spec`, `to-tickets`, `wayfinder`, `retro`, `implement`, `implement-spec`, `triage`, `setup-matt-pocock-skills` and `grill-me`. The pinned pstack copy in `.agents/pstack/`, its weekly update workflow, its CI check, `.claude/thread-start.md` and `.claude/pstack-models.md` are removed. Claude's verify skill in `.claude/skills/verify/` stays.

A Cursor cloud agent is a fallback only. It still reads home at `/agent/repos/home`, and `.cursor/` stays as it is.

This supersedes [0001](0001-per-pr-cloud-agents.md) (one cloud agent per pull request), [0006](0006-claude-threads-install-pstack.md) (threads install pstack) and [0015](0015-pinned-pstack-copy.md) (threads read a pinned pstack copy).

## Why

The work moved to T3 Code threads, and Matt Pocock's skills cover what pstack did with less machinery. The pinned copy, its pin, its weekly update and its CI check existed only to serve pstack, so they go with it.
