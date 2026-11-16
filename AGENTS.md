# Agent notes

This file is for anyone changing todae, including agents. It holds the rules that are specific to this repo. Shared rules live in Ben's home repo, [tounsoo/home](https://github.com/tounsoo/home) (private). Clone it to `~/repos/home` when that directory is missing (`https://github.com/tounsoo/home.git`). A Cursor cloud agent's git credential is scoped to its own repo and cannot clone home (`repository not found`). When the clone fails, read these files through the GitHub MCP tools instead. Read them before opening or driving a pull request:

- `AGENTS.md` there: the memory split, the learnings ladder, and how Cursor and Claude find pstack. A todae fact in this file overrides home.
- `CLAUDE.md` there: the Claude-only lines. This repo's `CLAUDE.md` adapts them for the pinned pstack copy.
- `standards/git.md` and `standards/pull-requests.md`
- `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md`. The **Repo lines** below fill those in ([0016](docs/decisions/0016-shared-agent-rules-live-in-home.md)).
- `pstack.pin.json` records the Cursor pstack pin and a pstack-claude pin. Threads in this repo read the pinned copy in `.agents/pstack/` ([0015](docs/decisions/0015-pinned-pstack-copy.md)). Home's pstack-claude pin is a newer commit, and these threads stay on the copy `pin.json` names.

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, commands, and pull requests. [ARCHITECTURE.md](ARCHITECTURE.md) records how the design system is built. Read it before adding or changing a component, hook, recipe, token or docs page. Dated decisions are in [docs/decisions](docs/decisions/README.md). A pull request that changes a decision or a spec also edits that decision's file. A design-system rule still belongs in `ARCHITECTURE.md`, updated in that same pull request.

## Set up

Use Node 24. `.nvmrc` names only that major version. CI reads that file, and `actions/setup-node` then uses the Node 24 the runner already has, or downloads the newest one when it has none. Install pnpm with Corepack so the version matches `packageManager` in the root `package.json`. Then run `pnpm install`. The [Set up](CONTRIBUTING.md#set-up) section has the rest.

## Build, test, and check

Build the package with `pnpm build:ds`. [Build the design system](CONTRIBUTING.md#build-the-design-system) says what that writes. [Check your change](CONTRIBUTING.md#check-your-change) lists every command, and which change class skips which jobs. The [rule table](#rule-table) names each check. Run `pnpm build:ds` before `pnpm test` in a fresh checkout, because the docs unit tests import the built package.

The blocking check name is `Checks`. `Token consumers` is informational (`continue-on-error: true`) and lists the components that read a changed token. [Changesets](CONTRIBUTING.md#changesets) version and publish `@tounsoo/todae`. [Releases](ARCHITECTURE.md#releases) records the same rules.

## Repo lines

These fill the **Repo lines** in home's `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md`. [0016](docs/decisions/0016-shared-agent-rules-live-in-home.md) records why the copies are not in this repo.

- Base branch: `main`.
- Checks, in the order [Check your change](CONTRIBUTING.md#check-your-change) lists. The [rule table](#rule-table) names each check. Claude proves the change with `node .claude/skills/verify/verify.mjs run` and puts `node .claude/skills/verify/verify.mjs body` under Verification. Cursor drives the docs site with `.cursor/skills/verify/SKILL.md`.
- Dependents to pass as context: importers of a changed export; CSS that uses a changed token, custom property or selector; tokens that alias a changed token; the English and Korean docs pages that describe the changed behavior; the tests that cover it.
- Push builds a preview: yes. Every push to GitHub builds a Vercel preview, so push only after a clean round.
- Drafts: allowed. Mark a draft ready after a clean round. `Checks` fails on a draft on purpose. The error says the pull request is a draft and that marking it ready runs the checks. That failure is the mark-ready signal. A `Checks` conclusion from while the pull request was a draft does not count as done.
- Required check name: `Checks`. Informational: `Token consumers`. When its failure is the only one, treat the pull request as clean and mention the failure in the report. A Vercel preview is a commit status. Mention a pending or failed preview in the report. An `unstable` state that the preview alone causes counts as clean.
- After merging `origin/main`: run `pnpm schema` and commit `packages/design-system/schema/components.json` when it changed. Stamp a translation with `pnpm --filter docs i18n:stamp ko <slug>` only after the Korean matches the English. The script requires the locale and at least one slug. `.agents/playbooks/docs-translation.md` says when.
- After a conflict-free merge of `origin/main`, run the checks in the first step of the review round, push, and mark the pull request ready when it is still a draft.
- A pull request another session already watches stays untouched: no push, comment, ready or resolve. Tell Ben. A request only to check on a pull request reads its state with the GitHub MCP tools, using home's status rules plus the lines above, and leaves the pull request unchanged.
- Pull request body: [`.github/pull_request_template.md`](.github/pull_request_template.md). It keeps the three sections from home's `standards/pull-requests.md` and adds Why, What changed and Scope. Unverified checks and Remaining risks say `None` only when that is true. Verification starts with the tested commit, the full SHA the checks ran on.

The columns, the weeds log and the suppression baseline follow home's [self-correcting standard](https://github.com/tounsoo/home/blob/main/standards/self-correcting.md). `pnpm check:self` checks them.

## Rule table

Tier: T0

| ID | Rule | Enforcer | Evidence | Status |
| --- | --- | --- | --- | --- |
| lint | ESLint | `pnpm lint` | #44 | seeded |
| require-description | An eslint-disable comment has a description | `eslint:eslint-comments/require-description` | #282 | seeded |
| use-client-placement | Keep 'use client' in src/index.ts or a provider, as the first statement | `eslint:todae/use-client-placement` | #282 | seeded |
| focus-without-scroll | Move focus with focusWithoutScroll when the move must not scroll | `eslint:todae/focus-without-scroll` | #282 | seeded |
| no-hidden-type | A value a form validates is not type hidden | `eslint:todae/no-hidden-type` | #282 | seeded |
| prop-naming | Form state props are disabled and invalid | `eslint:todae/prop-naming` | #282 | seeded |
| dev-only-diagnostics | console diagnostics run only outside production | `eslint:todae/dev-only-diagnostics` | #282 | seeded |
| layer-imports | Package layers import only the layers below them | `eslint:todae/layer-imports` | #319 | seeded |
| stylelint | Stylelint on component CSS | `pnpm stylelint` | #283 | seeded |
| no-raw-value | Component CSS uses tokens instead of raw values | `stylelint/no-raw-value.mjs` | #283 | seeded |
| no-raw-literal | No pill lengths, raw line-height, opacity, easing or 1px hairlines | `stylelint/no-raw-literal.mjs` | #285 | seeded |
| local-custom-property | A custom property a sheet sets starts with --_ | `stylelint/local-custom-property.mjs` | #285 | seeded |
| disabled-state | A disabled state has no opacity, and its cursor is not-allowed or inherit | `stylelint/disabled-state.mjs` | #285 | seeded |
| token-root-scope | A sheet reads only token roots it owns | `stylelint/token-root-scope.mjs` | #285 | seeded |
| focus-ring-token | A focus ring uses the focus or chip ring tokens | `stylelint/focus-ring-token.mjs` | #285 | seeded |
| typecheck | Typecheck | `pnpm typecheck` | #2 | seeded |
| unit-test | Unit tests | `pnpm test` | #3 | seeded |
| browser-test | Browser tests | `pnpm test:browser` | #45 | seeded |
| tokens-check | Generated token files match | `pnpm tokens:check` | #3 | seeded |
| schema | The component schema matches the source | `pnpm schema`, `.github/workflows/ci.yml` | #2 | seeded |
| build | The package builds | `pnpm build:ds` | #2 | seeded |
| publish-check | The packed tarball passes publint and attw | `pnpm publish:check` | #259 | seeded |
| ssr-smoke | The packed package loads and renders in Next.js | `pnpm ssr:smoke` | #262 | seeded |
| forbidden-paths | No scratch paths in a diff | `.github/scripts/forbidden-paths.sh` | #281 | seeded |
| verify-self-test | Cursor's verify script self-test | `.cursor/skills/verify/verify.mjs` | #307 | seeded |
| pinned-actions | Remote actions are pinned to a commit | `.github/scripts/pinned-actions.mjs` | #359 | seeded |
| changeset | A package change carries a changeset | `.github/scripts/changeset-exempt.mjs`, `.github/workflows/ci.yml` | #171 | seeded |
| token-api | No public token is removed, renamed or retyped | `pnpm tokens:api:check` | #279 | seeded |
| token-consumers | Report components that read a changed token | `packages/design-system/scripts/token-consumers.ts` | #287 | seeded |
| firefox-quarantine | Known Firefox browser failures warn in CI | `packages/design-system/scripts/firefox-quarantine.ts` | #369 | seeded |
| pstack-pin | The vendored pstack copy matches its pin | `.agents/pstack/check.sh` | #457 | seeded |
| pstack-upstream | The pin is on upstream's default branch | `.github/scripts/pstack-upstream.sh` | #457 | seeded |
| change-class | The diff is classed all, prose or markdown | `.github/scripts/classify-diff.sh` | #298 | seeded |
| docs-axe | axe on the built docs site | `apps/docs/playwright.config.ts` | #189 | seeded |
| docs-peek | Behavior tests on the built docs site | `apps/docs/playwright.peek.config.ts` | #293 | seeded |
| fernway-example | The second-brand example builds | `examples/fernway/package.json` | #187 | seeded |
| docs-build | The docs site builds | `.github/workflows/ci.yml` | #99 | seeded |
| checks | The Checks aggregate | `.github/workflows/ci.yml` | #241 | seeded |
| release | The release workflow | `.github/workflows/release.yml` | #171 | seeded |
| docs-deploy | Docs deploy | `.github/workflows/docs-deploy.yml` | #398 | seeded |
| pstack-update | The weekly pstack update | `.github/workflows/pstack-update.yml` | #457 | seeded |
| self | Rule table, weeds log and suppressions | `pnpm check:self` | a48ac02cb1a90b5225fea99a8daeb618772c27e3 | seeded |

## CI jobs

`.github/workflows/ci.yml` runs on every push to `main` and on a pull request when it opens, gets a push, reopens, or is marked ready. It has no paths filter.

On a draft whose change class is not `markdown`, the jobs that run are Changes, Check, Token API, Token consumers, Forbidden paths and rule-checker, and `Checks` fails as the repo lines say.

A change classed `markdown` runs Changes, Forbidden paths, rule-checker and Checks. Checks allows the other jobs to be skipped. `rule-checker` still runs, because the rule table lives in this file. [Check your change](CONTRIBUTING.md#check-your-change) lists the Markdown files that count as read and so leave the `markdown` class. A change classed `prose` still runs Build (including `pnpm publish:check`, `pnpm ssr:smoke` and `pnpm test`), Docs build and pages, Token API, Token consumers, Forbidden paths, rule-checker, and the pinned-actions step of Static. Fernway and Engines start, then skip their browser tests.

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
