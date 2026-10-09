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

Layers: core (`:root` literals) → appearance (`[data-appearance]`; light on a `:root` without that attribute) → density (`[data-density]`; comfortable on a `:root` without that attribute) → contract (`:root, [data-appearance], [data-density]`) → button variants (`[data-button-variant]`). Flatten `a.b.c` → `--todae-a-b-c`. Import the catalog as `@tounsoo/todae/tokens.json`.

## Providers

Wrap the tree in `ThemeProvider` and `DensityProvider`. `appearance="system"` (default) writes `data-appearance="system"`, which follows `prefers-color-scheme` in CSS, so server-rendered HTML already matches the user's scheme. `useAppearance()` returns `light` or `dark` from `matchMedia`, and `light` on the server. `DensityProvider` writes `data-density` (`compact` | `comfortable` | `spacious`, default `comfortable`). Nested providers override. Both are optional: with neither, the page gets light and comfortable. Components read contract vars only.

```tsx
import { DensityProvider, ThemeProvider, Button } from '@tounsoo/todae';

<ThemeProvider appearance="system">
  <DensityProvider density="comfortable">
    <Button.Root>Save</Button.Root>
  </DensityProvider>
</ThemeProvider>
```

`useAppearance()` and `useDensity()` read the nearest provider. `ThemeProvider` also accepts `overrides?: ThemeOverride` — a closed map of raw, semantic, and component token paths to typed values, applied as CSS vars on the provider root. Unknown keys and raw CSS are rejected.

## Generate the component schema

```sh
pnpm schema
```

The generator reads `packages/design-system/src/**/*.meta.ts` and writes `packages/design-system/schema/components.json`. Commit that file. A later `pnpm schema` must leave no diff.

## Run the docs

```sh
pnpm build:ds
pnpm dev:docs
```

`pnpm dev` is the same as `pnpm dev:docs`.

Open `/` for the full index, grouped as the sidebar is: Foundations (guides, Composition, `/tokens`, `/platform`), Components (one page per component, e.g. `/button`, plus native + CSS pages such as `/link`), Utilities (one page per headless hook, `/utilities/*`; `useAppearance` and `useDensity` sit with their providers on `/tokens`), Recipes (`/recipes/*`) and Tools (`/playground`). Component and hook pages mount a live example and a props table from the schema. `/tokens` tables the generated catalog. `/playground` is a left-rail theme controller (presets, appearance + density selectors, raw / semantic / component token tabs, Copy JSON) and a right-stage live demo.

The docs come in English and Korean. English pages live in `apps/docs/app/(en)` at unprefixed URLs. Korean pages live in `apps/docs/app/ko` under `/ko`; every page is translated, and a page added later without a Korean version shows the English one under a notice. The header links to the same page in each language. To translate a page or add a language, see [`apps/docs/TRANSLATING.md`](apps/docs/TRANSLATING.md).

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

## Docs MCP

Read-only Streamable HTTP MCP at `https://todae-rho.vercel.app/api/mcp` (`apps/docs/app/api/[transport]`).

```json
"todae-docs": { "url": "https://todae-rho.vercel.app/api/mcp" }
```

Tools: `list_components`, `get_component`, `when_to_use`. They read `@tounsoo/todae/schema/components.json` and the English pages, `apps/docs/app/(en)/**/page.mdx`. A missing "When to use" section returns `status: "missing"` and is not inferred.

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
- `apps/docs` is the Next.js 15 docs app with MDX examples.

The component set is still growing and is not a finished design system.
