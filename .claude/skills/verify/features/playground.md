# Playground

The playground lets a reader change tokens on live components. The page heading is `Playground` in English and `플레이그라운드` in Korean.

## Sub-features

- `playground-en` renders `/playground` with heading `Playground`.
- `playground-ko` renders `/ko/playground` with heading `플레이그라운드`.
- `playground-menu` keeps the menu button visible at 1280.

## How to get to it (user POV)

- Choose `Playground` or `플레이그라운드` in the top bar.
- On the home page, choose `Open the playground` or `플레이그라운드 열기`.

## Driving it with verify.mjs

Preconditions:

- Doctor passed for `/playground` and `/ko/playground`.

- **Both languages.** Run `node --experimental-strip-types --no-warnings=ExperimentalWarning .claude/skills/verify/verify.mjs run --url <origin> --expect-sha <head> --deployment-sha <sha> --deployment-id <id> --paths /playground`. The helper also opens `/ko/playground`. The report contains `heading en 1280 /playground Playground` and `heading ko 1280 /ko/playground 플레이그라운드`.
- **Wide menu.** At 1280 the menu button stays visible. The helper must not fail the header check for that button on this page.
- **Proof.** Heading lines for a text change. `en-1280-playground.png`, `en-390-playground.png`, `ko-1280-ko_playground.png`, and `ko-390-ko_playground.png` for a UI change.

## Gotchas

- The playground has no sidebar, so `.mobile-nav-trigger` stays visible at 1280. Treating that button as a narrow-only control fails this page.
- The top link and the hero button use different strings. The top link is `Playground`. The hero button is `Open the playground`.
- Token edits in the playground are local to the browser tab. A verification run must not need them.
