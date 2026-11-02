# Todae docs verification map

This directory is the source for driving the docs site. Read it before a run, then follow the feature file for each page the change touches.

## Baseline preconditions

- Node 24, from `.nvmrc`.
- For a preview, a `READY` deployment whose `meta.githubCommitSha` equals the pull request head. Project `todae`, id `prj_EUJCIhRJSkC2BYTOnw5Blfu153Zm`.
- For a local run, `node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs launch` and a clean `apps/docs` tree.
- `node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs self-test` passes. `pnpm check` runs it.
- Do not drive a docs server on port 3321 that this helper did not start.
- Do not treat `https://todae.omsoo.design` as a pull request preview. It tracks `docs-stable`.

## Driving conventions

- Start from the paths the pull request edits. When it edits no docs route, drive `/` and `/ko`.
- Drive English and Korean. Korean paths use the `/ko` prefix.
- Drive at 1280 and 390 CSS pixels wide.
- Use accessible names from `apps/docs/lib/i18n/dictionaries.ts`.
- Run the helper from the repo root. Keep every flag it prints.
- Leave `.verify/evidence` in place after cleanup.

## Proof and skip reporting

- Record the path, the locale, the width, and the result.
- UI proof is the PNG pair at both widths in both languages.
- Docs proof is the rendered heading and count lines in `report.txt`.
- Logic proof is the test command and its output. CI proof is the run link.
- Name the feature file used. A path you did not open is unverified.

## Feature entry contract

Each feature file has an H1, one paragraph, and these four H2 sections in order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with verify.mjs`
4. `Gotchas`

## Features

- [Home](./home.md) covers the English and Korean home pages, the group counts from `SITE_GROUPS`, and the header on those pages.
- [Header](./header.md) covers the brand, the top links, the language switcher, GitHub, and the narrow menu.
- [Button page](./button.md) covers a component page in both languages.
- [Playground](./playground.md) covers the playground route in both languages, including the menu button that stays on a wide screen.
