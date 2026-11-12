# Pinned pstack

This folder holds the copy of [pstack-claude](https://github.com/michael-denyer/pstack-claude) that todae's agent threads use. Threads read it from the checkout and download nothing. [0015](../../docs/decisions/0015-pinned-pstack-copy.md) records why.

- `plugin/` is upstream's `plugins/pstack` folder at one commit: the skills, the agents and the rest, with the MIT licenses and notice in `plugin/skills/poteto-mode/references/licenses/`. Don't edit it by hand. Todae's changes to pstack belong in `.agents/playbooks/`, `.claude/thread-start.md` and `.claude/models.md`.
- `pin.json` names the upstream commit the copy is at.
- `check.sh` checks that the copy is complete and that every quoted anchor in `.agents/playbooks/` is still in the pstack playbook it extends. Threads run it at the start, as `.claude/thread-start.md` says. It reads text only.
- `update.sh` replaces `plugin/` with upstream's folder at a commit and rewrites `pin.json`. Only the update workflow runs it, because it downloads code.

## Updates

[`.github/workflows/pstack-update.yml`](../../.github/workflows/pstack-update.yml) runs every Monday at 9:17 AM Seoul time, and by hand from the Actions tab. It runs `update.sh` for upstream's newest commit. If that changes the copy, it commits it to the `pstack-update` branch and opens one pull request, or updates the one already open. The pull request body links upstream's changes and gives the result of `check.sh`. It opens nothing when the copy is current, or when a pull request for the same upstream commit was closed without merging. Each update reaches threads only once Ben merges it.

When `check.sh` fails on an update, a todae playbook quotes pstack text that upstream changed. Change that playbook in the same pull request before it merges.

## The first copy

The copy this folder started with came from todae's own history, not from a download: the vendored copy removed on 2026-11-02, at upstream `49b68501b075ec1eb2755dd0d22fbf2492d67e97`, with todae's Fable-to-Opus rewrites taken back out. It lacks five skills that the old copy skipped (`babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`) and any upstream file the old copy never held, such as the plugin manifest. Its `effort-agents/` and `hooks/` folders are rebuilt from where the old update script put them. The first update pull request brings in upstream's folder word for word.
