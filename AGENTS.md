# Agent notes

This file is for anyone changing todae, including agents. It holds the rules that are specific to this repo. Shared rules live in Ben's home repo, [tounsoo/home](https://github.com/tounsoo/home) (private). Clone it to `~/repos/home` when that directory is missing (`https://github.com/tounsoo/home.git`) and read these before opening or driving a pull request:

- `AGENTS.md` there: the memory split, the learnings ladder, and how Cursor and Claude find pstack. A todae fact in this file overrides home.
- `CLAUDE.md` there: the Claude-only lines. This repo's `CLAUDE.md` adapts them for the pinned pstack copy.
- `standards/git.md` and `standards/pull-requests.md`
- `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md`. The **Repo lines** below fill those in ([0016](docs/decisions/0016-shared-agent-rules-live-in-home.md)).
- `pstack.pin.json` records the Cursor pstack pin and a pstack-claude pin. Threads in this repo read the pinned copy in `.agents/pstack/` ([0015](docs/decisions/0015-pinned-pstack-copy.md)). Home's pstack-claude pin is a newer commit, and these threads stay on the copy `pin.json` names.

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, commands, and pull requests. [ARCHITECTURE.md](ARCHITECTURE.md) records how the design system is built. Read it before adding or changing a component, hook, recipe, token or docs page. Dated decisions are in [docs/decisions](docs/decisions/README.md). A pull request that changes a decision or a spec also edits that decision's file. A design-system rule still belongs in `ARCHITECTURE.md`, updated in that same pull request.

## Set up

Use Node 24. `.nvmrc` names only that major version. CI reads that file, and `actions/setup-node` then uses the Node 24 the runner already has, or downloads the newest one when it has none. Install pnpm with Corepack so the version matches `packageManager` in the root `package.json`. Then run `pnpm install`. The [Set up](CONTRIBUTING.md#set-up) section has the rest.

## Build, test, and check

Build the package with `pnpm build:ds`. [Build the design system](CONTRIBUTING.md#build-the-design-system) says what that writes. [Check your change](CONTRIBUTING.md#check-your-change) lists every command CI expects, and which change class skips which jobs. Run `pnpm build:ds` before `pnpm test` in a fresh checkout, because the docs unit tests import the built package.

- `pnpm check` runs lint, typecheck, Stylelint, and the self-test of Cursor's verify script (`.cursor/skills/verify/verify.mjs self-test`). The Static job runs it when the change class is `all` and the pull request is not a draft. The draft `Check` job runs it when the class is not `markdown`.
- `pnpm test` runs the root script tests (Stylelint, ESLint, Claude's verify script, and `.github/scripts`) and then each workspace's unit tests. The Build job runs it.
- `pnpm test:browser` runs the browser tests in every engine its configs list. The Fernway job runs them with `--project chromium`, and the Engines jobs run the package's in Firefox and in WebKit, all inside Playwright's Docker image. In Firefox in CI, a failure of a test on the quarantine in `packages/design-system/scripts/firefox-quarantine.ts` (issue 367) warns instead of failing the job. A local Firefox run fails on those tests.
- `pnpm tokens:check` fails when generated token files drift. The Static job runs it for a change classed `all`.
- `pnpm schema` writes `packages/design-system/schema/components.json`. The Static job fails when that file has a diff.
- The Docs build and pages job builds the package and the docs site, then runs `pnpm --filter docs test:axe` and `pnpm --filter docs test:peek`.

The blocking check name is `Checks`. `Token consumers` is informational (`continue-on-error: true`) and lists the components that read a changed token. [Changesets](CONTRIBUTING.md#changesets) version and publish `@tounsoo/todae`. [Releases](ARCHITECTURE.md#releases) records the same rules.

## Repo lines

These fill the **Repo lines** in home's `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md`. [0016](docs/decisions/0016-shared-agent-rules-live-in-home.md) records why the copies are not in this repo.

- Base branch: `main`.
- Checks, in this order: `pnpm check`, `pnpm tokens:check`, `pnpm schema` (no diff in `packages/design-system/schema/components.json`), `pnpm build:ds`, `pnpm publish:check`, `pnpm ssr:smoke`, `pnpm test`, `pnpm test:browser`. A docs change also runs `pnpm --filter docs build`, `pnpm --filter docs test:axe` and `pnpm --filter docs test:peek`. Claude proves the change with `node .claude/skills/verify/verify.mjs run` and puts `node .claude/skills/verify/verify.mjs body` under Verification. Cursor drives the docs site with `.cursor/skills/verify/SKILL.md`.
- Dependents to pass as context: importers of a changed export; CSS that uses a changed token, custom property or selector; tokens that alias a changed token; the English and Korean docs pages that describe the changed behavior; the tests that cover it.
- Push builds a preview: yes. Every push to GitHub builds a Vercel preview, so push only after a clean round.
- Drafts: allowed. Mark a draft ready after a clean round. `Checks` fails on a draft on purpose. The error says the pull request is a draft and that marking it ready runs the checks. That failure is the mark-ready signal. A `Checks` conclusion from while the pull request was a draft does not count as done.
- Required check name: `Checks`. Informational: `Token consumers`. When its failure is the only one, treat the pull request as clean and mention the failure in the report. A Vercel preview is a commit status. Mention a pending or failed preview in the report. An `unstable` state that the preview alone causes counts as clean.
- After merging `origin/main`: run `pnpm schema` and commit `packages/design-system/schema/components.json` when it changed. Stamp a translation with `pnpm --filter docs i18n:stamp ko <slug>` only after the Korean matches the English. The script requires the locale and at least one slug. `.agents/playbooks/docs-translation.md` says when.
- After a conflict-free merge of `origin/main`, run the checks in the first step of the review round, push, and mark the pull request ready when it is still a draft.
- A pull request another session already watches stays untouched: no push, comment, ready or resolve. Tell Ben. A request only to check on a pull request reads its state with the GitHub MCP tools, using home's status rules plus the lines above, and leaves the pull request unchanged.
- Pull request body: [`.github/pull_request_template.md`](.github/pull_request_template.md). It keeps the three sections from home's `standards/pull-requests.md` and adds Why, What changed and Scope. Unverified checks and Remaining risks say `None` only when that is true. Verification starts with the tested commit, the full SHA the checks ran on.

## CI jobs

`.github/workflows/ci.yml` runs on every push to `main` and on a pull request when it opens, gets a push, reopens, or is marked ready. It has no paths filter.

On a draft whose change class is not `markdown`, the jobs that run are Changes, Check, Token API, Token consumers and Forbidden paths, and `Checks` fails as the repo lines say.

A change classed `markdown` runs Changes, Forbidden paths and Checks. Checks allows the other jobs to be skipped. [Check your change](CONTRIBUTING.md#check-your-change) lists the Markdown files that count as read and so leave the `markdown` class. A change classed `prose` still runs Build (including `pnpm publish:check`, `pnpm ssr:smoke` and `pnpm test`), Docs build and pages, Token API, Token consumers, Forbidden paths, and the pinned-actions step of Static. Fernway and Engines start, then skip their browser tests.

## Conventions

- A user-facing change carries a changeset. Follow `.agents/playbooks/changesets.md`. Do not release 1.0.0. [Versioning](README.md#versioning) says how bumps work until then.
- A design token changes only when Ben approves that change in his own message. Follow `.agents/playbooks/tokens.md`.
- An English docs page and its Korean twin change together. Follow `.agents/playbooks/docs-translation.md`.
- Cursor's verify skill is `.cursor/skills/verify/SKILL.md` ([0005](docs/decisions/0005-verify-procedure.md)). Claude's is `.claude/skills/verify/SKILL.md` and ends in PASS, FAIL or BLOCKED ([0007](docs/decisions/0007-claude-verify-and-pr-template.md)). Run the one for the tool in use on the commit that ends each review round, before a pull request opens and before each push of new work.
- The Claude model sheet is `.claude/pstack-models.md`. The pinned copy's skills read it. A change to a role's model or effort goes there, with Ben's yes. Cursor's installed pstack reads the user sheet home describes (`~/.cursor/rules/pstack-models.mdc`, written by `/setup-pstack`).
- Briefs use `.claude/task-prompt.md`.
- `.agents/playbooks/` holds the playbooks that are about this repo: `changesets.md`, `docs-translation.md` and `tokens.md`. Open each one whose `when` line fits the task.
- Git follows home's `standards/git.md`. This repo's base branch is `main`.
- A change to `.claude/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`, or the `.claude/**` entry in the `ignores` list in `eslint.config.mjs`, needs Ben's yes. Home's `standards/git.md` covers the shared half of that rule.

## Where the tools look

- Cursor reads this file. Its docs-site skill stays at `.cursor/skills/verify/`. Graft's rule, hooks and MCP config stay in `.cursor/`.
- Claude reads `CLAUDE.md`, which imports this file and `.claude/pstack-models.md`. A Duet thread then follows `.claude/thread-start.md`, because a thread loads nothing in `.claude/` by itself and an `@` import does not expand.
