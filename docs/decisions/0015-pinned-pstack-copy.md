# 0015. Threads read a pinned pstack copy that a weekly workflow updates

- **Date:** 2026-11-12
- **Status:** Active
- **Source:** Ben, 2026-11-12: "Daily action", then "For now, use github action weekly".

## Decision

The repository keeps a copy of pstack-claude's `plugins/pstack` folder in `.agents/pstack/plugin`, word for word, with the upstream commit and the copy's Git tree id in `.agents/pstack/pin.json`. A Claude Duet thread reads `CLAUDE.md`, then `.claude/thread-start.md`, which runs `.agents/pstack/check.sh`. That script checks the committed copy against the tree id and checks the quoted anchors in `.agents/playbooks/` against the copy's playbooks. It reads text only. CI's Forbidden paths job runs it on every change too, and when `pin.json` changes it also checks that the tree id is upstream's folder at that commit, on upstream's default branch. Threads download nothing.

`.github/workflows/pstack-update.yml` runs every Monday, and by hand. It replaces the copy with upstream's newest commit and opens one pull request, or updates the one already open by merging `main` in and committing on top, with upstream's changes linked and the check's result in its body. Each new pull request gets its own `pstack-update/<commit>` branch, so no branch is rewritten or deleted. It opens nothing when the copy is current or when Ben closed a pull request for the same copy without merging, keyed by the copy's tree id so that an upstream commit outside `plugins/pstack` doesn't bring a closed copy back. An update reaches threads only once Ben merges it. The pull request pushes with the release app's token, so CI runs on it. CI counts the copy and its pin as files no tool reads, so it runs only Changes, Forbidden paths and Checks on an update, and Docs deploy builds nothing for it. Forbidden paths lets the copy hold PNG and `*-body.md` files, since those two checks stop anything but upstream's own. `.claude/models.md` alone keeps threads off pstack's Fable defaults, since the copy is upstream's text, so each update pull request lists the changed files that name Fable. While a changeset waits on `main`, merging an update still refreshes the Version Packages pull request, which builds a preview as on any push to `main`.

0006's install step and its line that the repository keeps no copy no longer hold. The rest of [0006](0006-claude-threads-install-pstack.md) stands: how threads read pstack the todae way, when they follow `poteto-mode`, one pull request per thread, and Ben's yes for changes to `.claude/`, `.agents/` and `CLAUDE.md`.

## Why

The session's permission check sometimes refused 0006's download at thread start as code from an external source, which left threads without pstack. A copy in the checkout needs no download, and the weekly update keeps it close to upstream with every change reviewed before threads use it. The copy sits in `.agents/` rather than `.claude/`, because Forbidden paths allows only Markdown, JSON and `.mjs` files to be added under `.claude/`, and pstack ships TypeScript and shell scripts.
