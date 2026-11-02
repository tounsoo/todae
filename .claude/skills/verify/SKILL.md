---
name: verify
description: "Prove a Todae docs-site change the way a reader sees it: drive the English and Korean pages at 1280 and 390 CSS pixels, locally on port 3321 or on the pull request's Vercel preview, and save evidence that matches the change. Use for any change under apps/docs, a docs or UI pull request, a preview check, poteto-mode's Shipping UI step, or /verify (this project skill replaces the bundled one)."
---

# Verify the Todae docs site

This is the Claude copy of the verify skill. `.cursor/skills/verify/` holds the Cursor copy. The two share `verify.mjs` and `features/`, and [0005](../../../docs/decisions/0005-verify-procedure.md) lists what must stay matched. A change here makes the same change there, in the same pull request.

The docs app is Next.js in `apps/docs`. English URLs have no prefix and Korean URLs start with `/ko`. Home group counts come from `SITE_GROUPS` in `apps/docs/components/siteGroups.ts`. `HomeContent` prints one count per group from the group's own links, not its child pages. The top bar is `SiteShell`.

## Before a run

1. Read `features/README.md`, then the feature file for each page the diff touches. When the diff edits no docs route, drive `/` and `/ko`.
2. Pick the paths: the docs routes the diff edits, in either locale. The helper adds the other locale.
3. Pick the target. Use the pull request's Vercel preview when there is one. Otherwise run locally.

Run every helper command with Bash from the repo root, on Node 24, with `--experimental-strip-types` so the helper can import `SITE_GROUPS` and `localizePath`:

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs <command>
```

`self-test` checks that the helper still imports `SITE_GROUPS` and reads the dictionaries. It also checks the guards: an empty `--paths`, a path that leaves the deployment, a page off the verified origin, a host that only starts with `127.`, and a preview with no deployment id are refused. It does not open the site. `pnpm check` runs it, then `scripts/verify-skill-sync.mjs`, which fails when a shared file differs between the two copies or either `SKILL.md` drops a shared rule. Run `self-test` yourself first when you edited the docs config or dictionaries:

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs self-test
```

The helper drives Chromium through the docs app's `playwright` package. If the browser is missing, install it once with `pnpm --filter docs exec playwright install chromium`. If the session can't download it, DRIVE can't run: report the drive checks as unverified, and don't swap in another browser tool and call it the same proof.

## LAUNCH

Preview. The Vercel project is `todae` (`prj_EUJCIhRJSkC2BYTOnw5Blfu153Zm`) on team `team_8iiNJ83cVoixqY1F3xzd566X`.

- Read the pull request's full 40-character head SHA with the GitHub MCP tools (`pull_request_read`), not `gh`.
- Find the deployment with the Vercel MCP tools, loading them with ToolSearch if they are deferred. Call `list_deployments` with the project id, the team id and the head SHA, so the head's deployment isn't lost past the first page, then `get_deployment` on the match. Use the deployment whose ready state (`readyState` or `state`, depending on the tool) is `READY` and whose `meta.githubCommitSha` equals that head. Keep its `dpl_` id for `--deployment-id`.
- Open `https://` plus that deployment's `url`. Never use `https://todae.omsoo.design` for a pull request or for `main`, because that host tracks `docs-stable`.
- `*.vercel.app` asks for Vercel SSO, and custom domains don't. Run the helper under `vc env run --` so `VERCEL_OIDC_TOKEN` is set, and never print the token. The helper adds `x-vercel-trusted-oidc-idp-token` to requests for that deployment's origin. A redirect that such a request starts can carry the header, and docs redirects stay on the same origin.
- When `vc` is missing or not linked in the session, a share URL in `VERIFY_URL` is the fallback. The Vercel MCP tool `get_access_to_vercel_url` can make one. Still pass the plain deployment URL as `--url`, and keep the share query out of the report, the pull request and every log. With neither, run locally and say the preview went unchecked.

```sh
vc env run -- node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --url https://<deployment>.vercel.app --expect-sha <head> --deployment-sha <sha> --deployment-id <id> --paths /
```

Local. One verification server owns port 3321, and the helper refuses a port it did not open. `launch` starts `pnpm --filter docs exec next dev --port 3321` detached and returns once `http://127.0.0.1:3321/` answers 200 with `data-appearance` in the HTML, so ready means the home page answered, not only that a process exists. It gives up after 90 seconds and stops the server, and `.verify/scratch/server.log` then says why. A slow first compile can hit that limit, so run `launch` again before you call it broken.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs launch
node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --expect-sha "$(git rev-parse HEAD)" --paths /
```

`run --launch` does both steps. It stops the server afterwards only if this run started it, including when a check fails, and leaves a server it reused running.

## DOCTOR

`run` checks these first and writes no passing report when one fails. `doctor` and `drive` are the same command as `run`.

- The helper accepts a local URL on port 3321 (`127.0.0.1` or `localhost`), or an `https` URL on `*.vercel.app`. It rejects every other host, `https://todae.omsoo.design` included, and a host name that only starts with `127.`, such as `127.example.com`.
- Preview: pass the SHA you read from the deployment as `--deployment-sha` and the head as `--expect-sha`. The helper compares the two flags and labels the line `source=caller-asserted`. It does not call the Vercel API. Pass the deployment's `dpl_` id as `--deployment-id`. The helper refuses a preview without it and writes it on the doctor line. It does not look the id up, so the id is caller-asserted too. The helper trusts `VERIFY_URL` or `--url` and sends the OIDC header to the host it names, so pass the URL of that same deployment.
- Local: `.verify/scratch/server.json` names the pid, that process's command contains `next` and `3321`, `git rev-parse HEAD` equals `--expect-sha`, and `apps/docs` and `packages/design-system` have no uncommitted changes.
- Each path is a site path such as `/button`. The helper refuses one that would leave the origin of `VERIFY_URL` or `--url`, before it starts the browser. A redirect can still carry the OIDC header off that origin, as LAUNCH says.
- Each path returns 200 with `data-appearance` in the HTML. A login wall fails here.

## DRIVE

The helper opens each path in English and Korean at 1280 and at 390 CSS pixels wide. On every page it checks the header:

- The banner link `Todae` points at `/` or `/ko`.
- The GitHub link points at `https://github.com/tounsoo/todae`, named `Todae on GitHub` or `GitHub의 Todae`.
- The language navigation shows `English` and `한국어`, pointing at the unprefixed path and at `/ko` plus that path. It is not the `Main` nav.
- At 1280, Get started, Components and Playground show in the page language, and Components points at the first `SITE_GROUPS` components link (`/alert` or `/ko/alert`).
- At 390 those links are `display: none`, because the top links hide below 768px (`max-width: 48rem` in `apps/docs/app/globals.css`), so the helper reads their hrefs from `nav.top-links`. The `Open navigation` or `탐색 메뉴 열기` button is visible, the dialog it opens shows Get started, and the close button dismisses it. The menu button is hidden from 1024px up except on the playground.

On `/` and `/ko` it also checks each `section.home-group`: the heading is the localized group label, and `.home-group-count` reads `{count} pages` or `1 page` in English, and `{count}개 페이지` or `1개 페이지` in Korean, where the count is `group.links.length`.

Each feature file names the extra checks for its page. Find elements by role and accessible name from `apps/docs/lib/i18n/dictionaries.ts`, never by coordinates.

## EVIDENCE

The helper writes `.verify/evidence/<stamp>/`: `report.txt` is the log, `latest` names the newest stamp from the moment that run starts, whether it passes or fails, a refused `--launch` or a missing `--expect-sha` included, so read its `report.txt` before you cite it, and the screenshots are full-page PNGs named `<locale>-<width>-<slug>.png`. Open the PNGs with Read and look at them before you call a UI change proven.

Cite the proof that matches the change in the pull request's Verification section. The PNGs stay in `.verify/evidence`, so for screenshots cite the stamp and file names and say what each one showed when you read it:

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

Cleanup signals the pid in `.verify/scratch/server.json` only when `ps` shows `next` and `3321` in its command, then removes the pid file. A second cleanup with no pid file is a no-op.

## Keeping it current

When a route, a header label or a home count changes, update `features/` in both copies in the same pull request. `maintain-verification-skill` keeps this map honest. It finds only this copy, so make each of its corrections in `.cursor/skills/verify/` too, in the same pull request. This repo already has a verify skill, so don't run `create-verification-skill` here.
