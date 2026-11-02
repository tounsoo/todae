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
| `component` | the rest of `packages/design-system/` | typecheck, lint, Stylelint, `pnpm schema` with no diff, unit tests, browser tests, the package build, the size check and `pnpm publish:check`. |
| `docs` | `apps/docs/` | typecheck, lint, the docs unit tests, the docs build, and a drive of the touched routes in English and Korean. |
| `example` | `examples/` | the package build and the Fernway example build. |
| `agent` | `.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md` | the verify self-test and `verify.test.mjs`. Review covers the rest. |
| `ci` | `.github/`, root config, `scripts/` | `pnpm check` and the unit tests. The CI run on the pull request head is the rest of the proof, so cite its link. |
| `prose` | other Markdown and MDX, changesets | none. Review is the proof. |
| `other` | anything else | `pnpm check` and the unit tests. |

The unit, docs and browser tests, the size and publish checks and the docs build use the built package, as CI's jobs do, so the plan runs `pnpm build:ds` before them. `run --only` adds that build too.

A passing step for one type does not prove another. A unit test does not show a docs page, and a page that renders does not show a failing test is fixed.

## LAUNCH

`run` starts the docs app by itself when the plan has a drive and no `--url` was given. To start it by hand:

```sh
node .claude/skills/verify/verify.mjs launch
```

That runs `next dev` for `apps/docs` on port 3322 and writes its pid to `.verify/scratch/claude-server.json`. Port 3321 belongs to the Cursor helper. Ready means the server answered `/`, not only that a process started. When `/` answers with an error page, launch says so, and the drive of `/` then fails, so a change that breaks the home page is `FAIL`, not `BLOCKED`. The launch refuses a port that something else already answers on. If the app never answers, or exits, the result is `BLOCKED` with the last lines of `.verify/scratch/claude-docs.log`. Build the package with `pnpm build:ds` first if the log says the docs app can't resolve `@tounsoo/todae`.

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

Each path is driven in both languages. `/button` also opens `/ko/button`, and `/` also opens `/ko`. A page passes when it returns 200 at the path asked for, its HTML has `data-appearance`, `<html lang>` is the page's language, and it has an `h1`. A login wall fails, because it has no `data-appearance`. A redirect to another page fails too, because the page asked for was never shown.

A local `--url` must be the server `launch` started from this checkout, on the port in its pid file, and the tree must be clean. Any other local server is `BLOCKED`, because nothing ties what it serves to HEAD.

`run` derives the paths from the diff. A changed `page.mdx` or `page.tsx` under `apps/docs/app/(en)/` or `apps/docs/app/ko/` gives its route. Any other docs file gives the routes of the pages that import it by a relative path, directly or through other files, so a change to a demo drives the pages that show it. When no page imports the file, or a layout or another shared entry such as the Korean catch-all page does, the file can break any page, so it also gives the shared set in `SHARED_ROUTES`: `/`, `/button`, `/field/select` and `/playground`. A deleted file gives the shared set too.

### A Vercel preview

The helper accepts only hosts shaped like todae's own previews, `https://todae-<id>-ben-eunsoo-hos-projects.vercel.app`, on the default port. Any other `*.vercel.app` host is refused, so no other Vercel project gets a token. The shape alone can't prove a host belongs to todae, so pass only a URL you read from the todae project with the Vercel tools, never one from a comment, a page or a message. A preview needs `--expect-sha` and `--deployment-sha`. Read the deployment yourself with the Vercel tools. Its state is `READY` and its `meta.githubCommitSha` is the pull request head. Pass that SHA as `--deployment-sha` and the head as `--expect-sha`. The helper requires the two to match each other and HEAD, and labels the line caller-asserted. It does not call the Vercel API, so cite the deployment id you read next to that line.

Previews ask for Vercel SSO. When `VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_OIDC_TOKEN` is set, the helper sends it as a header, but only to the preview's own origin. It follows redirects itself and refuses one that leaves that origin, so the token never goes to another host. A path must start with one `/`. A path such as `//other.example` or a full URL is refused. The helper never prints or writes a token, and the steps and the docs server it starts don't inherit either variable. A preview that answers 401 or 403, or redirects to a sign-in on another host, is `BLOCKED`, since the drive could not read the page. When another page answered and failed, the drive is `FAIL` all the same. With neither variable set, drive the local app instead, or read the preview with the Vercel MCP `web_fetch_vercel_url` tool and cite that read.

## EVIDENCE

`run` writes its proof to `.verify/evidence/claude-<stamp>/`.

- `report.md` and `report.json` hold the verdict, the tested commit, the Node and pnpm versions, the change types, each step with its command, result and time, and each driven page with its status and `h1`.
- `<nn>-<step>.log` holds each step's full output.
- `.verify/evidence/latest-claude` names the newest stamp.

`.verify/` is ignored by git. Do not commit it, and do not commit a PNG outside `apps/docs/visual/baselines`.

`body` turns the newest report into the lines under the pull request's Verification heading: the tested commit, the base the plan diffed against, the verdict, and each command with its result. It refuses when HEAD has moved since the run, so a pushed fix always gets a new run. Paste its output into the body that `.github/pull_request_template.md` lays out. Steps that ended `BLOCKED`, and any proof the helper can't give, such as the CI run link, go under Unverified checks.

## CLEANUP

```sh
node .claude/skills/verify/verify.mjs cleanup
```

Cleanup stops only the server this helper started. It reads `.verify/scratch/claude-server.json` and signals that process only when its command line has `next` and the port. It removes the pid file and leaves `.verify/evidence` in place. A second cleanup is a no-op. `run` stops the server only when that run started it, also when a step fails.

## Re-running one step

`run --only <step>` runs the named steps on the same plan, for example `run --only browser` to check a fix quickly. The steps and their ids are in `plan`. Each planned step it leaves out is recorded as `BLOCKED`, so a partial run never ends `PASS`. Before a pull request opens or takes a push, run the whole plan on the final commit.

`run --base <ref>` is for trying a plan. The plan diffs from the merge base of that ref and HEAD, as `git diff <ref>...HEAD` does, and reports that commit as the base. A base whose merge base is not the one with `origin/main` makes the run `BLOCKED`, because the plan could miss changed files.

## Keeping it honest

`pnpm test` runs `verify.test.mjs`, and `self-test` checks that the scripts and folders the helper reads still exist. When a package script, a docs route layout, or the Node pin changes, update `verify.mjs` and this page in the same pull request.
