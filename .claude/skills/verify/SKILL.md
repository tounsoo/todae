---
name: verify
description: "Prove a todae change on the commit it was tested at, with the proof its change type needs, and report PASS, FAIL or BLOCKED. Use before opening or updating a pull request, for /verify, or when a thread has to say how a change was tested."
---

# Verify a todae change

This is the Claude verifier. Cursor keeps its own docs-site skill at `.cursor/skills/verify/`, and this skill does not change or call it.

The helper is `verify.mjs` in this folder. Run it from the repository root with the Node version in `.nvmrc`. Every command prints its result, and `run` ends with one verdict line.

```sh
node .claude/skills/verify/verify.mjs plan
node .claude/skills/verify/verify.mjs run
node .claude/skills/verify/verify.mjs body
```

## Verdicts

A run ends in one of three verdicts. The exit code carries it.

- `PASS` (exit 0). Every step the change type needs ran on the tested commit and passed.
- `FAIL` (exit 1). A step ran and failed. Fix the cause and run again.
- `BLOCKED` (exit 2). A step could not run, so nothing proves the change either way. A missing tool, the wrong Node version, a dirty tree, a docs server that never answered, and a preview that is not the tested commit are all `BLOCKED`.

`BLOCKED` is not a pass. Fix what blocked the run and run again, or report the step as unverified in the pull request, with the reason the helper printed. Never write `PASS` for a run that ended `BLOCKED`.

## Proof by change type

`plan` maps each changed file to the first type that matches it, then lists the steps those types need. Read the plan before the run, so the proof fits the change.

| Type | Files | Proof |
| --- | --- | --- |
| `tokens` | `packages/design-system/tokens/` | `pnpm tokens:check`, `pnpm tokens:api:check` and the unit tests. A token change also needs Ben's approval, as `.agents/playbooks/tokens.md` says. |
| `component` | the rest of `packages/design-system/` | typecheck, lint, Stylelint, `pnpm schema` with no diff, unit tests, browser tests, the package build and the size check. |
| `docs` | `apps/docs/` | typecheck, lint, the docs unit tests, and a drive of the touched routes in English and Korean. |
| `example` | `examples/` | the package build and the Fernway example build. |
| `agent` | `.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md` | the verify self-test. Review covers the rest. |
| `ci` | `.github/`, root config, `scripts/` | `pnpm check` and the unit tests. The CI run on the pull request head is the rest of the proof, so cite its link. |
| `prose` | other Markdown and MDX, changesets | none. Review is the proof. |
| `other` | anything else | `pnpm check` and the unit tests. |

A passing step for one type does not prove another. A unit test does not show a docs page, and a page that renders does not show a failing test is fixed.

## LAUNCH

`run` starts the docs app by itself when the plan has a drive and no `--url` was given. To start it by hand:

```sh
node .claude/skills/verify/verify.mjs launch
```

That runs `next dev` for `apps/docs` on port 3322 and writes its pid to `.verify/scratch/claude-server.json`. Port 3321 belongs to the Cursor helper. Ready means `/` returned 200 and its HTML has `data-appearance`, not only that a process started. The launch refuses a port that something else already answers on. If the app never answers, the result is `BLOCKED` with the last lines of `.verify/scratch/claude-docs.log`. Build the package with `pnpm build:ds` first if the log says the docs app can't resolve `@tounsoo/todae`.

## DOCTOR

`run` runs doctor first and stops before any step when doctor fails. Doctor checks that:

- the Node major version matches `.nvmrc`,
- `pnpm --version` matches `packageManager` in the root `package.json`,
- `node_modules` exists,
- `git status --porcelain` is empty,
- HEAD resolves to a full 40-character SHA.

The tested commit is that HEAD. The tree has to be clean, so the commit is the code that ran. After the steps, the helper checks HEAD and the tree again. A change during the run makes the verdict `BLOCKED`.

## DRIVE

The drive reads pages over HTTP. It takes no screenshots.

```sh
node .claude/skills/verify/verify.mjs drive --url http://127.0.0.1:3322 --paths /button
```

Each path is driven in both languages. `/button` also opens `/ko/button`, and `/` also opens `/ko`. A page passes when it returns 200, its HTML has `data-appearance`, `<html lang>` is the page's language, and it has an `h1`. A login wall fails, because it has no `data-appearance`.

`run` derives the paths from the diff. A changed `page.mdx` or `page.tsx` under `apps/docs/app/(en)/` or `apps/docs/app/ko/` gives its route. Any other docs file gives `/`.

### A Vercel preview

A preview at `https://<deployment>.vercel.app` needs `--expect-sha` and `--deployment-sha`. Read the deployment yourself with the Vercel tools. Its state is `READY` and its `meta.githubCommitSha` is the pull request head. Pass that SHA as `--deployment-sha` and the head as `--expect-sha`. The helper requires the two to match and labels the line caller-asserted. It does not call the Vercel API.

Previews ask for Vercel SSO. When `VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_OIDC_TOKEN` is set, the helper sends it as a header, but only to the preview's own origin. It follows redirects itself and refuses one that leaves that origin, so the token never goes to another host. A path must start with one `/`. A path such as `//other.example` or a full URL is refused. The helper never prints or writes a token. With neither variable set, drive the local app instead, or read the preview with the Vercel MCP `web_fetch_vercel_url` tool and cite that read.

## EVIDENCE

`run` writes its proof to `.verify/evidence/claude-<stamp>/`.

- `report.md` and `report.json` hold the verdict, the tested commit, the Node and pnpm versions, the change types, each step with its command, result and time, and each driven page with its status and `h1`.
- `<nn>-<step>.log` holds each step's full output.
- `.verify/evidence/latest-claude` names the newest stamp.

`.verify/` is ignored by git. Do not commit it, and do not commit a PNG outside `apps/docs/visual/baselines`.

`body` turns the newest report into the pull request's Verification section, with the tested commit and each command with its result. It refuses when HEAD has moved since the run, so a pushed fix always gets a new run. Paste its output into the body that `.github/pull_request_template.md` lays out. Steps that ended `BLOCKED`, and any proof the helper can't give, such as the CI run link, go under Unverified checks.

## CLEANUP

```sh
node .claude/skills/verify/verify.mjs cleanup
```

Cleanup stops only the server this helper started. It reads `.verify/scratch/claude-server.json` and signals that process only when its command line has `next` and the port. It removes the pid file and leaves `.verify/evidence` in place. A second cleanup is a no-op. `run` stops the server only when that run started it, also when a step fails.

## Re-running one step

`run --only <step>` runs the named steps on the same plan, for example after a fix, `run --only browser`. The steps and their ids are in `plan`. A partial run proves only the steps it ran, and `body` lists only those.

## Keeping it honest

`pnpm test` runs `verify.test.mjs`, and `self-test` checks that the scripts and folders the helper reads still exist. When a package script, a docs route layout, or the Node pin changes, update `verify.mjs` and this page in the same pull request.
