# Home

The home page lists every docs group. Each group shows its localized name and a count of its own links. The count is how many entries that group has in `SITE_GROUPS`, not how many child pages those entries have.

## Sub-features

- `home-en` renders `/` with the English hero title and five group counts.
- `home-ko` renders `/ko` with the Korean hero title and the same five counts.
- `home-counts` shows `N pages` or `1 page` in English, and `N개 페이지` or `1개 페이지` in Korean.
- `home-header` shows the header links for the locale, at 1280 and at 390.

## How to get to it (user POV)

- Open the site root.
- Choose `한국어` in the language navigation, which goes to `/ko`.
- Choose the `Todae` mark, which returns to that locale's home.

## Driving it with verify.mjs

Preconditions:

- Doctor passed for the origin under test.
- `self-test` printed a group list, including `tools:2`.

- **English home.** Open `/` at 1280 and at 390. Run `node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --url <origin> --expect-sha <head> --deployment-sha <sha> --deployment-id <id> --paths /`. The helper also opens `/ko`. The report contains `home en 1280 h1 The foundation your design system builds on.` and a `home en` line for each group id.
- **Korean home.** The same command opens `/ko`. The report contains `home ko 1280 h1 회사의 디자인 시스템을 그 위에 세우세요.` and Korean group labels such as `컴포넌트`.
- **Counts.** Each `home` line ends with the count text for that group's `links.length`. The helper imports `SITE_GROUPS`. A home page with no `.home-group` sections fails.
- **Proof.** `report.txt` has the `home` lines. The stamp directory has `en-1280-root.png`, `en-390-root.png`, `ko-1280-ko.png`, and `ko-390-ko.png`.

## Gotchas

- Child pages under Field are not part of the components count. The home list uses `group.links.length`.
- The sidebar is hidden on the home page at every width. Header checks still apply.
- A count of 1 uses the singular string. No current group has one link. Do not change the helper to accept only the plural.
- Korean group names come from `DICTIONARIES.ko.groups`. A missing name falls back to the English label in `SITE_GROUPS`.
