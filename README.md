# Todae

What you need to do today.

Todae is a pnpm workspace. `@tounsoo/todae` is a private Vite library. `apps/docs` is a Next.js 15 app that renders live MDX examples from that library.

## Requirements

- Node 22. `nvm use` reads `.nvmrc`.
- pnpm 10. The root `package.json` `packageManager` field pins the version.

## Install

```sh
pnpm install
```

## Build the design system

Docs import the built `dist/` files through package exports. Build the package first.

```sh
pnpm build:ds
```

The build writes `packages/design-system/dist/index.js`, `index.d.ts`, and `todae.css`. The CSS file declares `@layer todae.reset, todae.base, todae.components` and includes generated token vars.

Watch the package while you edit it:

```sh
pnpm dev:ds
```

`dev:ds` does not rebuild `.d.ts` files. Run `pnpm build:ds` when you need fresh types.

## Tokens

DTCG source lives in `packages/design-system/tokens/`. The build emits CSS custom property **chains** (not resolved literals) plus `tokens/tokens.generated.json`.

```sh
pnpm tokens
pnpm tokens:check
```

Commit both generated files. `tokens:check` fails if they drift.

Layers: core (`:root` literals) → appearance (`[data-appearance]`, light also on `:root`) → density (`[data-density]`) → contract (`[data-appearance], [data-density]`) → button variants (`[data-button-variant]`). Flatten `a.b.c` → `--todae-a-b-c`. Import the catalog as `@tounsoo/todae/tokens.json`.

## Providers

Wrap the tree in `ThemeProvider` and `DensityProvider`. `appearance="system"` (default) follows `prefers-color-scheme` via `useSyncExternalStore` and writes only `data-appearance="light"` or `"dark"`. The SSR snapshot is `light`. `DensityProvider` writes `data-density` (`compact` | `comfortable` | `spacious`, default `comfortable`). Nested providers override. Seed components read contract vars only.

```tsx
import { DensityProvider, ThemeProvider, Button } from '@tounsoo/todae';

<ThemeProvider appearance="system">
  <DensityProvider density="comfortable">
    <Button.Root>Save</Button.Root>
  </DensityProvider>
</ThemeProvider>
```

`useAppearance()` and `useDensity()` read the nearest provider. `ThemeProvider` also accepts `overrides?: ThemeOverride` — a closed map of raw, semantic, and component token paths to typed values, applied as CSS vars on the provider root. Unknown keys and raw CSS are rejected.

## Agent catalog

The published package ships `@tounsoo/todae/catalog.json` plus `@tounsoo/todae/catalog` helpers. Components come from `src/**/*.meta.ts`. Patterns live in `src/catalog/patterns/*.pattern.ts`. One generator writes both `catalog/catalog.json` and the `schema/components.json` projection (name/description/props only; kept one release).

```sh
pnpm catalog
```

`pnpm schema` is an alias. Commit both generated files. A later `pnpm catalog` must leave no diff.

```ts
import catalog from '@tounsoo/todae/catalog.json'
import { search, listForIntent, getComponent } from '@tounsoo/todae/catalog'

search('modal')[0]?.entry.name // Dialog
listForIntent('choose-one')
getComponent('OptionList')
```

Search is lexical. No embeddings, no Jev, no Graft runtime.

Wren reviews `whenToUse` / `whenNotToUse` arrays in `*.meta.ts` and `*.pattern.ts` only. Roots, hooks, providers, and patterns require at least one `whenToUse` bullet. Parts may ship empty arrays until Wren fills them. `pnpm catalog` regenerates JSON.

`schema/components.json` is deprecated. Prefer `catalog.json`.

### Mapping to Jev (app-side)

Todae adapters emit templates and criteria. They do not emit concrete Jev candidates.

```ts
import { catalog, toRenderCatalog, toCandidateRecipe, toCriteria } from '@tounsoo/todae/catalog'

toRenderCatalog(catalog.components)
toCandidateRecipe(catalog.patterns[0])
toCriteria(catalog.components[0])
```

`toRenderCatalog` maps each component prop type string to a JSON Schema subset. `boolean`, `string`, `number`, and `"a" | "b"` unions become schema. Other TypeScript types stay opaque as `{ "x-todae-type": "..." }`.

`toCandidateRecipe` copies a pattern tree and keeps every `$fill`. The `fills` array lists holes the app must supply. The adapter does not write domain copy or `$state`.

`toCriteria` maps `whenToUse` / `whenNotToUse` to `prefer` / `avoid`. Use it to write candidate descriptions on the app side.

The app supplies concrete props, copy, and `$state` bindings per request. This package does not import Jev.

State non-goals:

- No Jev import or runtime in this package
- No `$state` in adapter output
- No export named `toJevCriteria` or similar

### Catalog MCP

`packages/catalog-mcp` (`@tounsoo/todae-mcp`) is a stdio MCP server over the same `@tounsoo/todae/catalog.json`. Not a second schema. Not plug-and-play Jev. No Graft or secrets.

```sh
pnpm build:ds
pnpm --filter @tounsoo/todae-mcp build
node packages/catalog-mcp/dist/cli.js
```

Cursor: `.cursor/mcp.json` → `todae-catalog`. Tools wrap the package helpers. Resource `todae://catalog.json` is the raw file bytes.

## Run the docs

```sh
pnpm build:ds
pnpm dev:docs
```

`pnpm dev` is the same as `pnpm dev:docs`.

Open `/`, `/catalog`, `/button`, `/stack`, `/text`, `/tokens`, and `/playground`. Component pages mount a live example and a props table from `catalog.json`. `/optionlist` shows `<WhenToUse />`. `/catalog` is an MCP hookup plus one `search` example. `/tokens` tables the generated token catalog. `/playground` is a left-rail theme controller (appearance + density selectors, raw / semantic / component token tabs, Export) and a right-stage live demo.

## Test

```sh
pnpm test
```

## Typecheck

```sh
pnpm typecheck
```

## Deploy docs

Set the Vercel project Root Directory to `apps/docs`. `apps/docs/vercel.json` installs from the repo root, builds `@tounsoo/todae`, then builds the docs app.

## Graft

Graft is a repo-root dev tool. It is not a runtime dependency. Cursor wiring
lives in `.cursor/` (always-apply rule, MCP pin `@nanonets/graft@0.18.0`, hooks).

```sh
pnpm graft:build
pnpm graft:check
```

`graft/` and `.graft/` stay on the machine that built them. Do not commit them.

## Layout

- `packages/design-system` is `@tounsoo/todae`, a private Vite library.
- `packages/catalog-mcp` is `@tounsoo/todae-mcp`, a stdio MCP server over the same `catalog.json`.
- `apps/docs` is the Next.js 15 docs app with MDX examples.

Button, Stack, and Text are seed components that prove the pipeline. They are not a design system.
