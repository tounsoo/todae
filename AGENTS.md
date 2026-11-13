# Agent notes

This file is for anyone changing the repo, including agents. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, commands, and pull requests. [ARCHITECTURE.md](ARCHITECTURE.md) records how the design system is built. Dated decisions are in [docs/decisions](docs/decisions/README.md).

## Set up

Use Node 24. `.nvmrc` names only that major version. CI reads that file, and `actions/setup-node` then uses the Node 24 the runner already has, or downloads the newest one when it has none. Install pnpm with Corepack so the version matches `packageManager` in the root `package.json`. Then run `pnpm install`. The [Set up](CONTRIBUTING.md#set-up) section has the rest.

## Build, test, and check

Build the package with `pnpm build:ds`. [Build the design system](CONTRIBUTING.md#build-the-design-system) says what that writes. [Check your change](CONTRIBUTING.md#check-your-change) lists every command CI expects.

- `pnpm check` runs lint, typecheck, Stylelint, and the self-test of Cursor's verify script. The Static job runs it.
- `pnpm test` runs the unit tests. The Build job runs it.
- `pnpm test:browser` runs the browser tests in every engine its configs list. The Fernway job runs them with `--project chromium`, and the Engines jobs run the package's in Firefox and in WebKit, all inside Playwright's Docker image. In Firefox, a failure of a test on the quarantine in `packages/design-system/scripts/firefox-quarantine.ts` (issue 367) warns instead of failing the job.
- `pnpm tokens:check` fails when generated token files drift. The Static job runs it.
- The Docs build and pages job builds the package and the docs site, then runs `pnpm --filter docs test:axe` and `pnpm --filter docs test:peek`.

[Changesets](CONTRIBUTING.md#changesets) version and publish `@tounsoo/todae`. [Releases](ARCHITECTURE.md#releases) records the same rules.

## Conventions

- A user-facing change carries a changeset. [Changesets](CONTRIBUTING.md#changesets) says how to add one, and when a change that ships nothing still needs `pnpm changeset --empty`.
- Every pull request body follows [`.github/pull_request_template.md`](.github/pull_request_template.md). It has a Verification section, an Unverified checks section, and a Remaining risks section. Verification starts with the tested commit, the full SHA the checks ran on, and lists each command with its result. Write "None" only when that is actually true. A pull request missing any of the three sections, or the tested commit, is not ready for review.
- After a fix for a bug, a review finding, or a maintainer correction (not routine edits), run a short reflect. Run correct only when the same kind of mistake shows up a second time, then enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.
- Cursor drives the docs site with its verify skill at `.cursor/skills/verify/SKILL.md`. [0005](docs/decisions/0005-verify-procedure.md) records that procedure. Claude verifies every change with `.claude/skills/verify/SKILL.md`, which ends in PASS, FAIL or BLOCKED. [0007](docs/decisions/0007-claude-verify-and-pr-template.md) records it.
- Do not change a design token unless Ben approves the change.
- Do not release 1.0.0. [Versioning](README.md#versioning) says how bumps work until then.
- Do not force-push or rebase unless Ben agrees.
- Agents do not merge. A merge waits until Ben approves it.
- Change `.claude/`, `.agents/`, `CLAUDE.md`, and the `.claude/**` entry in the `ignores` list in `eslint.config.mjs` only with Ben's yes.
- A pull request that adds a docs page, a docs section or a check also changes `CLAUDE.md` and the verify skill's `SKILL.md` or `verify.mjs` in `.claude/skills/verify/`. Where one or both need no change, its body says why on a line `Agent docs unchanged: <reason>`. CI's Agent docs job checks it, and [0016](docs/decisions/0016-agent-docs-check.md) says what counts.
- A pull request that changes a decision or a spec also edits that decision's file in `docs/decisions/` in the same pull request. A design-system rule still belongs in [ARCHITECTURE.md](ARCHITECTURE.md), updated in that same pull request.
