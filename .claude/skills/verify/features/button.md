# Button page

The Button page documents `Button.Root`. English and Korean both use the heading `Button`. The body copy differs.

## Sub-features

- `button-en` renders `/button` with heading `Button`.
- `button-ko` renders `/ko/button` with heading `Button` and Korean body copy.
- `button-header` runs the header checks on both pages.

## How to get to it (user POV)

- From home, open Components, then Button. The first components link in the top bar is Alert, not Button.
- Open `/button` or `/ko/button` directly.

## Driving it with verify.mjs

Preconditions:

- Doctor passed for `/button` and `/ko/button`.
- Both pages return 200.

- **English page.** Run `node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --url <origin> --expect-sha <head> --deployment-sha <sha> --deployment-id <id> --paths /button`. The helper also opens `/ko/button`. The report contains `heading en 1280 /button Button`.
- **Korean page.** The same command reports `heading ko 1280 /ko/button Button`.
- **Header.** Both widths report `header ok` for `/button` and `/ko/button`.
- **Proof.** For a text change, quote the heading lines. For a UI change, attach `en-1280-button.png`, `en-390-button.png`, `ko-1280-ko_button.png`, and `ko-390-ko_button.png`.

## Gotchas

- The Korean page keeps the English heading `Button`. A check that expects a translated h1 fails on a good page.
- Demos on the page are English in both locales. That is the known gap in `ARCHITECTURE.md`. Do not file it as a missing translation of the demo.
- The components top link goes to Alert. Reaching Button from the header takes the menu or the home list, not that top link.
