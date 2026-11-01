# Agent notes

This file is for anyone changing the repo, including agents. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, commands, and pull requests. [ARCHITECTURE.md](ARCHITECTURE.md) records how the design system is built. Dated decisions are in [docs/decisions](docs/decisions/README.md).

## Set up

Use Node 24. `.nvmrc` pins it, and CI reads that file. Install pnpm with Corepack so the version matches `packageManager` in the root `package.json`. Then run `pnpm install`. The [Set up](CONTRIBUTING.md#set-up) section has the rest.

## Build, test, and check

Build the package with `pnpm build:ds`. [Build the design system](CONTRIBUTING.md#build-the-design-system) says what that writes. [Check your change](CONTRIBUTING.md#check-your-change) lists every command CI expects.

- `pnpm check` runs lint, typecheck, and Stylelint. The Static job runs it.
- `pnpm test` runs the unit tests. The Build job runs it.
- `pnpm test:browser` runs the browser tests. The Fernway job installs Playwright Chromium, then runs it.
- `pnpm size:check` checks gzip size against the budget. Run `pnpm build:ds` first. The Build job runs it after that build.
- `pnpm tokens:check` fails when generated token files drift. The Static job runs it.
- The docs job builds the package and the docs site, then runs `pnpm --filter docs test:visual` and `pnpm --filter docs test:peek`.

[Changesets](CONTRIBUTING.md#changesets) version and publish `@tounsoo/todae`. [Releases](ARCHITECTURE.md#releases) records the same rules.

## Size budget

The bundle size budget is a tripwire, not a hard cap. A pull request may raise the numbers in `packages/design-system/size-budget.json` when the pull request body states the reason and the new number. `scripts/size-check.mjs` reads that file. An increase with no stated reason fails review. [0004](docs/decisions/0004-size-budget-tripwire.md) is the record.

## Conventions

- A user-facing change carries a changeset. [Changesets](CONTRIBUTING.md#changesets) says how to add one, and when a change that ships nothing still needs `pnpm changeset --empty`.
- Every pull request body has a Verification section, an Unverified checks section, and a Remaining risks section. Write "None" only when that is actually true. A pull request missing any of the three is not ready for review.
- After each fix, run reflect and correct. When the same correction comes up again, enforce it in this order: architecture, then types, then lint or CI, then a test. A written rule is the last resort.
- Drive the docs site with the verify skill at `.cursor/skills/verify/SKILL.md`. [0005](docs/decisions/0005-verify-procedure.md) records the procedure.
- Do not change a design token unless Ben approves the change.
- Do not release 1.0.0. [Versioning](README.md#versioning) says how bumps work until then.
- Do not force-push or rebase unless Ben agrees.
- Agents do not merge. A merge waits until Ben approves it.
- Leave `.claude/`, `.agents/`, `CLAUDE.md`, and the `.claude/**` entry in the `ignores` list in `eslint.config.mjs` unchanged.
- A pull request that changes a decision or a spec also edits that decision's file in `docs/decisions/` in the same pull request. A design-system rule still belongs in [ARCHITECTURE.md](ARCHITECTURE.md), updated in that same pull request.
