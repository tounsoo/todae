# 0006. Claude threads install pstack at thread start

- **Date:** 2026-11-02
- **Status:** Superseded by [0018](0018-drop-pstack-for-matt-skills.md), 2026-11-25
- **Source:** Ben's decisions of 2026-11-02 in the clean-slate `.claude` plan, and his choice of the latest pstack for every thread.

## Decision

A Claude Duet thread reads `CLAUDE.md`, then `.claude/thread-start.md`. That page installs the latest pstack-claude skills with the skills CLI into a temp folder outside the repository, fetches the pstack agent files at the same commit, and checks the quoted anchors in `.agents/playbooks/` against that commit's playbooks. The page then gives the todae adaptations for reading pstack from the temp folder, says when to follow `poteto-mode`, and sends every task that opens or pushes to a pull request through the todae playbooks. Each thread drives one pull request, and work that needs more waits for Ben to split it across threads: its own session runs the review round and does every write to the pull request, and no subagent writes to one.

The repository keeps no copy of pstack ([0015](0015-pinned-pstack-copy.md) replaced this with a pinned copy). `.claude/` holds `thread-start.md` and the model sheet, `.claude/pstack-models.md`. Shared review and CI playbooks are read from tounsoo/home ([0016](0016-shared-agent-rules-live-in-home.md)). The process rules home does not have stay in `.agents/playbooks/`. Agents change `.claude/`, `.agents/` and `CLAUDE.md` only with Ben's yes.

Cursor is separate. `.cursor/`, its verify skill and [0005](0005-verify-procedure.md) stay as they are. 0005 once said `.claude/` stays unchanged and holds the pstack port, which was the layout before this decision. It now points to the pinned copy in `.agents/pstack/`.

## Why

A Duet thread starts outside the repository and attaches it later, so nothing in `.claude/` loaded by itself: not the SessionStart hook, the agents, the skills, or the `@` import in `CLAUDE.md`. The pinned copy of pstack in `.claude/` was never read by threads. Ben chose the latest upstream for every thread over a reviewed pin.
