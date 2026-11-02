---
extends:
when: A todae pull request that changes what @tounsoo/todae ships, or that trips the changeset check.
---

### Changesets

1. A pull request that changes what `@tounsoo/todae` ships (its code, types, CSS, tokens, schema or CLI) adds a changeset. Tests, fixtures, snapshots, `CHANGELOG.md` and dotfiles don't count.
2. Write it with `pnpm changeset --patch @tounsoo/todae -m "…"`, or `--minor` for a breaking change, since `pnpm changeset` alone asks questions in a terminal. Never use `--major`, which would release 1.0.0.
3. Keep the text to one sentence that says what changed for people who use Todae and names the component, hook or token. A breaking change adds one bullet per break that says what to change in your code, as the Changesets section of `CONTRIBUTING.md` shows.
4. A change that ships nothing but still trips the check gets `pnpm changeset --empty`.
5. Commit the new file in `.changeset/` with the change. CI runs `changeset status`, which fails when the package changed and the pull request adds no changeset.
