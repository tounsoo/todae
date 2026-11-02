---
name: verify
description: "Prove a Todae docs-site change the way a reader sees it: drive the English and Korean pages at 1280 and 390 CSS pixels, locally on port 3321 or on the pull request's Vercel preview, and save evidence that matches the change. Use for any change under apps/docs, a docs or UI pull request, a preview check, poteto-mode's Shipping UI step, or /verify (this project skill replaces the bundled one)."
---

# Verify the Todae docs site

This is the Claude copy of the verify skill. `.cursor/skills/verify/` holds the Cursor copy. The two share `verify.mjs` and `features/`, and [0005](../../../docs/decisions/0005-verify-procedure.md) lists what must stay matched. A change here makes the same change there, in the same pull request.

The docs app is Next.js in `apps/docs`. English URLs have no prefix and Korean URLs start with `/ko`. Home group counts come from `SITE_GROUPS` in `apps/docs/components/siteGroups.ts`, and the top bar is `SiteShell`.

## Before a run

1. Read `features/README.md`, then the feature file for each page the diff touches. When the diff edits no docs route, drive `/` and `/ko`.
2. Pick the paths: the docs routes the diff edits, in either locale. The helper adds the other locale.
3. Pick the target. Use the pull request's Vercel preview when there is one. Otherwise run locally.

Run every helper command with Bash from the repo root, on Node 24, with `--experimental-strip-types` so the helper can import `SITE_GROUPS` and `localizePath`:

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs <command>
```

`pnpm check` runs `self-test`, then `scripts/verify-skill-sync.mjs`, which fails when `verify.mjs` or a `features/` file differs between the two copies. Run `self-test` yourself first when you edited the docs config or dictionaries:

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs self-test
```

The helper drives Chromium through the docs app's `playwright` package. If the browser is missing, install it once with `pnpm --filter docs exec playwright install chromium`. If the session can't download it, DRIVE can't run: report the drive checks as unverified, and don't swap in another browser tool and call it the same proof.

## LAUNCH

Preview. The Vercel project is `todae` (`prj_EUJCIhRJSkC2BYTOnw5Blfu153Zm`) on team `team_8iiNJ83cVoixqY1F3xzd566X`.

- Read the pull request's full 40-character head SHA with the GitHub MCP tools (`pull_request_read`), not `gh`.
- Find the deployment with the Vercel MCP tools (`list_deployments`, then `get_deployment`), loading them with ToolSearch if they are deferred. Use the deployment whose state is `READY` and whose `meta.githubCommitSha` equals that head. Keep its id for the report.
- Open `https://` plus that deployment's `url`. Never use `https://todae.omsoo.design` for a pull request or for `main`, because that host tracks `docs-stable`.
- `*.vercel.app` asks for Vercel SSO. Run the helper under `vc env run --` so `VERCEL_OIDC_TOKEN` is set, and never print the token. The helper sends `x-vercel-trusted-oidc-idp-token` only to that deployment's origin.
- When `vc` is missing or not linked in the session, a share URL in `VERIFY_URL` is the fallback. Still pass the plain deployment URL as `--url`, and keep the share query out of the report, the pull request and every log. With neither, run locally and say the preview went unchecked.

```sh
vc env run -- node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --url https://<deployment>.vercel.app --expect-sha <head> --deployment-sha <sha> --paths /
```

Local. One verification server owns port 3321, and the helper refuses a port it did not open. `launch` starts `pnpm --filter docs exec next dev --port 3321` detached and returns once `http://127.0.0.1:3321/` answers 200 with `data-appearance` in the HTML. The first compile is slow, so give the Bash call a long timeout instead of running it in the background.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs launch
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --expect-sha "$(git rev-parse HEAD)" --paths /
```

`run --launch` does both steps and stops the server afterwards only if it started it.

## DOCTOR

`run` checks these first and writes no passing report when one fails. `doctor` is the same command.

- The helper accepts a local URL on port 3321 (`127.0.0.1` or `localhost`), or an `https` URL on `*.vercel.app`. It rejects every other host, `https://todae.omsoo.design` included.
- Preview: pass the SHA you read from the deployment as `--deployment-sha` and the head as `--expect-sha`. The helper compares the two flags and labels the line `source=caller-asserted`. It does not call the Vercel API, so the line counts as proof only together with the deployment id you read.
- Local: `.verify/scratch/server.json` names the pid, that process's command contains `next` and `3321`, `git rev-parse HEAD` equals `--expect-sha`, and `apps/docs` and `packages/design-system` have no uncommitted changes.
- Each path returns 200 with `data-appearance` in the HTML. A login wall fails here.

## DRIVE

The helper opens each path in English and Korean at 1280 and at 390 CSS pixels wide. On every page it checks the header:

- The banner link `Todae` points at `/` or `/ko`.
- The GitHub link points at `https://github.com/tounsoo/todae`, named `Todae on GitHub` or `GitHub의 Todae`.
- The language navigation shows `English` and `한국어`, pointing at the unprefixed path and at `/ko` plus that path. It is not the `Main` nav.
- At 1280, Get started, Components and Playground show in the page language, and Components points at the first `SITE_GROUPS` components link (`/alert` or `/ko/alert`).
- At 390 those links are `display: none`, so the helper reads their hrefs from `nav.top-links`. The `Open navigation` or `탐색 메뉴 열기` button is visible, the dialog it opens shows Get started, and the close button dismisses it. The menu button is hidden from 1024px up except on the playground.

On `/` and `/ko` it also checks each `section.home-group`: the heading is the localized group label, and `.home-group-count` reads `{count} pages` or `1 page` in English, and `{count}개 페이지` or `1개 페이지` in Korean, where the count is `group.links.length`.

Each feature file names the extra checks for its page. Find elements by role and accessible name from `apps/docs/lib/i18n/dictionaries.ts`, never by coordinates.

## EVIDENCE

The helper writes `.verify/evidence/<stamp>/`: `report.txt` is the log, `latest` names the newest stamp, and the screenshots are full-page PNGs named `<locale>-<width>-<slug>.png`. Open the PNGs with Read and look at them before you call a UI change proven.

Cite the proof that matches the change, in the pull request's Verification section:

- A UI change: the screenshots at 1280 and 390, in English and Korean, for each page the change touches.
- A docs or text change: the rendered `h1`, group counts and heading lines from `report.txt`.
- A logic change: the test command and its output.
- A CI or config change: the run link.

A passing screenshot does not stand in for a failing test, and a test log does not stand in for a page. Name the feature files you used, and list every path you did not open under Unverified checks. Never commit `.verify/` or a PNG outside `apps/docs/visual/baselines`.

## CLEANUP

Stop only the server this helper started, then leave `.verify/evidence` in place.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs cleanup
```

Cleanup signals the pid in `.verify/scratch/server.json` only when `ps` shows `next` and `3321` in its command, then removes the pid file. A second cleanup is a no-op. A server that `run --launch` reused stays up.

## Keeping it current

When a route, a header label or a home count changes, update `features/` in both copies in the same pull request. `maintain-verification-skill` keeps this map honest, and it runs on both copies. This repo already has a verify skill, so don't run `create-verification-skill` here.
