# Pinned pstack

This folder holds the copy of [pstack-claude](https://github.com/michael-denyer/pstack-claude) that todae's agent threads use. Threads read it from the checkout and download nothing. [0015](../../docs/decisions/0015-pinned-pstack-copy.md) records why.

- `plugin/` is upstream's `plugins/pstack` folder at one commit: the skills, the agents and the rest, with the MIT licenses and notice in `plugin/skills/poteto-mode/references/licenses/`. Don't edit it by hand. Todae's changes to pstack belong in `.agents/playbooks/`, `.claude/thread-start.md` and `.claude/models.md`.
- `pin.json` names the upstream commit the copy is at, and Git's tree id for upstream's folder there.
- `check.sh` checks that the committed copy has that tree id, which proves it is upstream's folder word for word, that it has the skill and agents threads use, and that every quoted anchor in `.agents/playbooks/` is still in the pstack playbook it extends. Threads run it at the start, as `.claude/thread-start.md` says, and CI's Forbidden paths job runs it on every change. It reads text only.
- `update.sh` replaces `plugin/` with upstream's folder at a commit and rewrites `pin.json`. It refuses a folder with links or special files, or with no license. Only the update workflow runs it, because it downloads code.

## Updates

[`.github/workflows/pstack-update.yml`](../../.github/workflows/pstack-update.yml) runs every Monday at 9:17 AM Seoul time, and by hand from the Actions tab. Its steps are in [`.github/scripts/pstack-update.sh`](../../.github/scripts/pstack-update.sh), which `pstack-update.test.mjs` tests. It runs `update.sh` for upstream's newest commit. If that changes the copy and an update pull request is open, it merges `main` into that pull request's branch and commits the update on top. Otherwise it commits the update to a new `pstack-update/<commit>` branch and opens a pull request. No branch is rewritten or deleted. The pull request body links upstream's changes from `main`'s commit, lists the files upstream added or removed and the changed files that name Fable, and gives the result of `check.sh`. It opens nothing when the copy is current, when a pull request for the same upstream commit was closed without merging (reopen it to take that commit), or when that commit's branch is left without a pull request. Each update reaches threads only once Ben merges it.

When `check.sh` fails on an update, a todae playbook quotes pstack text that upstream changed, and CI fails. Change that playbook in the same pull request before it merges.

## The first copy

The copy this folder started with came from todae's own history, not from a download: the vendored copy removed on 2026-11-02, at upstream `49b68501b075ec1eb2755dd0d22fbf2492d67e97`, with todae's Fable-to-Opus rewrites taken back out. It lacks five skills that the old copy skipped (`babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`) and any upstream file the old copy never held, such as the plugin manifest. Its `effort-agents/` and `hooks/` folders are rebuilt from where the old update script put them. `pin.json` has no tree id yet, so `check.sh` can't check it word for word. The first update pull request brings in upstream's folder word for word and adds the id.
