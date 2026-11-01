---
name: verify
description: "Drive the Todae docs site in English and Korean, locally or on its Vercel preview, and save proof that matches the change. Use for a docs pull request, a preview check, or /verify."
---

# Verify the Todae docs site

Drive the Next.js docs app in `apps/docs` the way a reader does. English URLs have no prefix. Korean URLs start with `/ko`. Home group counts come from `SITE_GROUPS` in `apps/docs/components/siteGroups.ts`. `HomeContent` prints one count per group, using the group's own links and not its child pages. The top bar is `SiteShell`.

Read `features/README.md` before a run. Drive the pages the pull request edits. When the diff edits no docs route, drive `/` and `/ko`.

The helper is `verify.mjs` in this directory. Run it from the repo root with Node 24. Pass `--experimental-strip-types` so the helper can import `SITE_GROUPS` and `localizePath`.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs self-test
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs run --url https://<deployment>.vercel.app --expect-sha <head> --deployment-sha <deployment> --paths /
```

Proof stays in `.verify/evidence/<stamp>/`. Cleanup does not delete that directory.

## LAUNCH

Use a Vercel preview when the pull request has one. Otherwise start the app locally.

Preview. The project is `todae` (`prj_EUJCIhRJSkC2BYTOnw5Blfu153Zm`) on team `team_8iiNJ83cVoixqY1F3xzd566X`. List deployments for the pull request's head branch and full head SHA. Use the `READY` deployment whose `meta.githubCommitSha` is that SHA. Open `https://` plus that deployment's `url`. Do not use `https://todae.omsoo.design` for a pull request or for `main`. That host tracks `docs-stable`.

`*.vercel.app` asks for Vercel SSO. Custom domains do not. For a preview, run the helper with `VERCEL_OIDC_TOKEN` set and do not print the token.

```sh
vc env run -- node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs run --url https://<deployment>.vercel.app --expect-sha <head> --deployment-sha <sha>
```

The helper adds `x-vercel-trusted-oidc-idp-token` on requests whose URL is that deployment's origin. A redirect that request starts can carry the header. Docs redirects stay on the same origin. A share URL in `VERIFY_URL` is the fallback for a browser that stores cookies. Pass the plain deployment URL as `--url`. Do not write the share query into the report, the pull request, or a log.

Local. One verification server owns port 3321. The helper refuses a port it did not open.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs launch
```

That runs `pnpm --filter docs exec next dev --port 3321` and waits until `http://127.0.0.1:3321/` returns 200 and the HTML contains `data-appearance`. Ready means the home page answered, not only that a process exists.

## DOCTOR

Run doctor before trusting a page. `run` does this first and stops before it writes a passing report.

- Read the preview deployment yourself. Its state is `READY`, and `meta.githubCommitSha` equals the pull request head, full 40 characters. Pass that SHA as `--deployment-sha` and the head as `--expect-sha`. The helper compares the two flags and labels the report line `source=caller-asserted`. It does not call the Vercel API. A caller-asserted line is proof only together with the deployment id you read.
- Do not pass `https://todae.omsoo.design`. The helper rejects that host.
- A local URL is `http://127.0.0.1:3321` or `http://localhost:3321`. The pid file is `.verify/scratch/server.json`, the process command contains `next` and `3321`, `git rev-parse HEAD` equals `--expect-sha`, and `apps/docs` plus `packages/design-system` are clean.
- Each path in `--paths` returns 200 and the HTML contains `data-appearance`. A login wall fails this check.

`pnpm check` runs `self-test`. That command checks that the helper still imports `SITE_GROUPS` and reads the dictionaries. It does not open the site.

## DRIVE

Drive each selected path in English and Korean, at 1280 CSS pixels wide and at 390 CSS pixels wide. Pass either locale. The helper adds the other. `--paths /button` also opens `/ko/button`.

On every page the helper checks the header.

- The banner link named `Todae` points at `/` or `/ko`.
- The GitHub link points at `https://github.com/tounsoo/todae`. Its accessible name comes from the dictionary (`Todae on GitHub`, `GitHub의 Todae`).
- The language navigation (`Main` is a different nav) shows `English` and `한국어`. English points at the unprefixed path. Korean points at `/ko` plus that path.
- At 1280 the top navigation shows Get started, Components, and Playground in the page language. Components points at the first `SITE_GROUPS` components link (`/alert`, or `/ko/alert`).
- At 390 those three links are not visible. `display: none` removes them from the accessibility tree, so the helper reads `nav.top-links` and checks the hrefs there. The button named `Open navigation` or `탐색 메뉴 열기` is visible. Opening it shows Get started in the dialog. The close button dismisses the dialog.
- Below 768px the top links are `display: none` (`max-width: 48rem` in `apps/docs/app/globals.css`). The menu button is hidden from 1024px up except on the playground.

On `/` and `/ko` the helper also checks each `section.home-group`. The heading is the localized group label. The `.home-group-count` text is `{count} pages` or `1 page` in English, and `{count}개 페이지` or `1개 페이지` in Korean. The count is `group.links.length`.

Prefer these roles over coordinates. The feature files name the extra checks for a page.

## EVIDENCE

Save proof under `.verify/evidence/<stamp>/`. `report.txt` is the log. `latest` in `.verify/evidence` names the newest stamp. Screenshots are full-page PNGs named `<locale>-<width>-<slug>.png`.

Cite the proof that matches the change.

- A UI change needs the screenshots at 1280 and 390, in English and Korean, for each page the pull request touches.
- A docs or text change needs the rendered text in `report.txt` (the `h1`, the group counts, and the heading lines).
- A logic change needs the test command and its output.
- A CI or config change needs the run link.

A passing screenshot does not stand in for a failing test, and a test log does not stand in for a page the reader sees. Do not commit `.verify/`. Do not commit a PNG outside `apps/docs/visual/baselines`.

## CLEANUP

Stop only the server this helper started.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs cleanup
```

Cleanup reads `.verify/scratch/server.json` and signals that pid only when `ps` shows `next` and `3321` in its command. It removes the pid file. It leaves `.verify/evidence` in place. A second cleanup with no pid file is a no-op. `run --launch` stops the server only when that invocation started it, including when a check fails. A server it reused stays up.

## Helpers

`verify.mjs` is the only helper. `self-test` reads the source files. `launch` starts port 3321. `cleanup` stops that server. `run` checks the SHA, requests each path, checks the header and the home counts, and writes the evidence. `doctor` and `drive` are the same command as `run`.

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs self-test
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs launch
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs run --launch --expect-sha <head> --paths /
node --experimental-strip-types --no-warnings=ExperimentalWarning .cursor/skills/verify/verify.mjs cleanup
```

When a route, a header label, or a home count changes, update `features/` in the same pull request. The pass that keeps this map honest is `maintain-verification-skill`.
