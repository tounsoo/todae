# 0007. Claude verifies with its own skill, and pull requests use a template

- **Date:** 2026-11-02
- **Status:** Active
- **Source:** Ben's "Yes, fix both" on the audit of todae's `.claude` after PR 314, and his request to start the follow-up pull request.

## Decision

Claude has a verifier at `.claude/skills/verify/`. Its helper, `verify.mjs`, maps each changed file to a change type, runs the proof that type needs on the tested commit, and ends with one verdict: `PASS`, `FAIL` or `BLOCKED`. `BLOCKED` means a step could not run, and it is never reported as a pass. The procedure has the same five steps as [0005](0005-verify-procedure.md): LAUNCH, DOCTOR, DRIVE, EVIDENCE and CLEANUP. Its docs drive reads pages over HTTP in English and Korean and takes no screenshots. It sends a Vercel bypass token only to the preview's own origin and refuses a redirect or a path that leaves it.

Every pull request body follows `.github/pull_request_template.md`. Its Verification section starts with a tested-commit line, the full SHA the checks ran on, and lists each command with its result. The Unverified checks and Remaining risks sections stay, as `AGENTS.md` requires.

Briefs that start a thread, and briefs a thread gives a subagent, follow `.claude/task-prompt.md`.

Cursor is unchanged. `.cursor/skills/verify/` and 0005 still cover Cursor's docs-site checks.

## Why

The only verifier was Cursor's, and it covers the docs site alone. A Claude thread had no way to say which proof a change needed, no record of the commit it tested, and no outcome for a check it couldn't run. The Cursor helper could also send the bypass token to another host, and Ben chose to fix that on the Claude side and leave Cursor as it is.
