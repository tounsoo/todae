# 0006. Claude threads install pstack at thread start

- **Date:** 2026-11-02
- **Status:** Partly superseded by [0015](0015-pinned-pstack-copy.md), 2026-11-12: threads read a pinned copy in the repository instead of installing the latest pstack
- **Source:** Ben's decisions of 2026-11-02 in the clean-slate `.claude` plan, and his choice of the latest pstack for every thread.

## Decision

A Claude Duet thread reads `CLAUDE.md`, then `.claude/thread-start.md`. That page installs the latest pstack-claude skills with the skills CLI into a temp folder outside the repository, fetches the pstack agent files at the same commit, and checks the quoted anchors in `.agents/playbooks/` against that commit's playbooks. The page then gives the todae adaptations for reading pstack from the temp folder, says when to follow `poteto-mode`, and sends every task that opens or pushes to a pull request through the todae playbooks. Each thread drives one pull request, and work that needs more waits for Ben to split it across threads: its own session runs the review round and does every write to the pull request, and no subagent writes to one.

The repository keeps no copy of pstack ([0015](0015-pinned-pstack-copy.md) replaced this with a pinned copy). `.claude/` holds `thread-start.md` and the model sheet, `models.md`. Todae's own process rules are project playbooks in `.agents/playbooks/`. Agents change `.claude/`, `.agents/` and `CLAUDE.md` only with Ben's yes.

Cursor is separate. `.cursor/`, its verify skill and [0005](0005-verify-procedure.md) stay as they are. The sentence in 0005 that says `.claude/` stays unchanged and holds the pstack port describes the layout before this decision.

## Why

A Duet thread starts outside the repository and attaches it later, so nothing in `.claude/` loaded by itself: not the SessionStart hook, the agents, the skills, or the `@` import in `CLAUDE.md`. The pinned copy of pstack in `.claude/` was never read by threads. Ben chose the latest upstream for every thread over a reviewed pin.
