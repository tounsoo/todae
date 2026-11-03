# Header

The top bar carries the brand, three section links, the language switcher, and GitHub. On a narrow screen the three section links are hidden and the menu button opens them in a drawer.

## Sub-features

- `header-brand` links `Todae` to the locale home.
- `header-top` shows Get started, Components, and Playground at 1280.
- `header-narrow` hides those three links at 390 and opens the drawer from the menu button.
- `header-language` links `English` and `한국어` to the same page in the other language.
- `header-github` links to the repository.

## How to get to it (user POV)

- The bar is on every page, including home, a component page, and the playground.
- At a phone width, choose `Open navigation` or `탐색 메뉴 열기`.

## Driving it with verify.mjs

Preconditions:

- Doctor passed.
- The page under test is one of `--paths`.

- **Wide bar.** At 1280 the navigation named `Main` or `주요 메뉴` shows three links. Get started points at `/guides/get-started` or `/ko/guides/get-started`. Components points at `/alert` or `/ko/alert`. Playground points at `/playground` or `/ko/playground`. The menu button is not visible, except on the playground.
- **Narrow bar.** At 390 those three links are not visible. The menu button is visible. The helper opens it, finds the Get started link in the dialog, and closes the dialog before the screenshot.
- **Language.** `English` points at the unprefixed path. `한국어` points at the `/ko` path. Both stay visible at 390.
- **GitHub.** The link's accessible name is `Todae on GitHub` or `GitHub의 Todae`, and the href is `https://github.com/tounsoo/todae`.
- **Proof.** The report contains `header ok <path> <width>` for each pair. The PNG shows the closed drawer.

## Gotchas

- `max-width: 48rem` hides `.top-links`. 390 is under that breakpoint. 1280 is not. A check that requires the three links to be visible at 390 is wrong.
- The drawer does not contain a single link named Components. That label is the top bar's shortcut to `/alert`. The drawer lists Alert under the components group.
- The theme switch is hidden below 480px and remains in the drawer footer. It is not one of the header links.
- The playground keeps the menu button at 1280 because the page has no sidebar.
