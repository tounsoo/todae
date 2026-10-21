# Fernway: a second brand on Todae

Fernway is a made-up cabin-booking company. This app themes Todae for it with tokens only: no CSS written against a Todae component, and no fork. It uses `@tounsoo/todae` through its published entry points, the way an app outside this repository would.

## What it changes

- `tokens/core.json` extends Todae's `core` set: warm stone grays in place of Todae's cool ones, rounder radii, a humanist font stack and a heavier bold.
- `tokens/appearance/*.json` adds to Todae's `appearance` modifier: a forest green accent for light and dark, and Fernway's own `fernway.hero.*` colors.
- `tokens/button.json` extends Todae's `button` set to make every button a pill, and `tokens/contract.json` extends the `contract` set to give cards a shadow.
- `tokens/button.soft.json` adds a `soft` button variant, declared to TypeScript in `src/todae.d.ts`.
- `tokens/fernway.json` is a set of Fernway's own tokens, which `src/app.css` reads.
- `src/App.tsx` sets a partner lodge's colors at runtime with `ThemeProvider` `overrides` and the generated `THEME_OVERRIDE_TYPES`.

To change one of Todae's tokens, put it in a set or modifier with the same name as the Todae one that declares it. Each row of the token catalog, `@tounsoo/todae/tokens.json`, names that entry in `entry`, [Build on Todae](https://todae.omsoo.design/guides/build-on-todae) lists them, and the build names the right one when a token is in the wrong place.

## Run it

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:ds
pnpm install --frozen-lockfile --offline
pnpm --filter fernway-example dev
```

The second install links the `todae-tokens` command, which only exists once the package is built. An app that installs `@tounsoo/todae` from npm gets it on the first install.

`pnpm tokens` runs `todae-tokens build`, which writes `src/theme/todae-theme.css`, `src/theme/tokens.catalog.json` and `src/theme/todae-theme.types.ts`. They are generated on every `dev` and `build`, so they are not committed.
