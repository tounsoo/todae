# Claude instructions

## Architecture and decisions

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before adding or changing a component, hook, recipe, token or docs page. It records the concepts and decisions new work must follow. When a decision changes, update it in the same pull request.

## Docs translations

The docs site is in English and Korean. A change to an English `page.mdx` in `apps/docs/app/(en)` also changes its Korean twin in `apps/docs/app/ko`, in the same pull request, then runs `pnpm --filter docs i18n:stamp ko <slug>`. `apps/docs/TRANSLATING.md` has the details.

## Changesets

A pull request that changes what `@tounsoo/todae` ships adds a changeset, as the Releases section of `ARCHITECTURE.md` says. Write it with `pnpm changeset --patch @tounsoo/todae -m "…"` (or `--minor` for a breaking change before 1.0), since `pnpm changeset` alone asks questions in a terminal. A change that ships nothing but still trips the CI check gets `pnpm changeset --empty`. Keep the text to the one-line summary, plus one bullet per break for a breaking change, as `CONTRIBUTING.md` shows.

## pstack

This repository works the [pstack-claude](https://github.com/michael-denyer/pstack-claude) way. `.claude/skills/` and `.claude/agents/` hold the port, and its licenses are in `.claude/skills/poteto-mode/references/licenses/`. Cloud sessions don't load plugins, so `sh .claude/update-pstack.sh [commit]` copies the port in at a pinned commit; rerun it with a newer commit to update, and review the diff. It leaves out `babysit`, `fix-ci`, `fix-merge-conflicts` and `get-pr-comments`, which call `gh`, and `setup-pstack`, whose sheet is checked in below.

- `.claude/settings.json` runs pstack's SessionStart hook text, `.claude/pstack-session-start.md`, in every session, so tasks route to `poteto-mode`.
- `.claude/pstack-models.md` is the model sheet. Edit it to change a role's model or effort.
- `.agents/playbooks/` holds the project playbooks. `review-before-pr.md` runs the review on the branch before a pull request opens. `waiting-on-ci.md` drives a pull request to green with the GitHub MCP tools.

@.claude/pstack-models.md

These lines adapt pstack to this environment:

- Skills and agents are project files, so they have no plugin prefix. Where pstack names `pstack:<name>`, use `<name>`.
- A `<plugin>` path in a skill means `.claude/`.
- `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, add a line to its prompt telling it not to edit files, commit, or push.
- GitHub work uses the GitHub MCP tools, not `gh`, Origin, or the `watch-pr` script.
- Fable runs only where the model sheet names it or Ben approves it in the run. `update-pstack.sh` never touches the sheet, and it rewrites skill defaults that name `fable` to `opus`.
