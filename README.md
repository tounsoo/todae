# Todae

What you need to do today.

Todae is a pnpm workspace. `@omsoo.design/todae` is a Vite library, released to npm with Changesets (see [Release](#release)). `apps/docs` is a Next.js 15 app that renders live MDX examples from that library.

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

Layers: core (`:root` literals) → appearance (`[data-appearance]`; light on a `:root` without that attribute) → density (`[data-density]`; comfortable on a `:root` without that attribute) → contract (`:root, [data-appearance], [data-density]`) → button variants (`[data-button-variant]`). Flatten `a.b.c` → `--todae-a-b-c`. Import the catalog as `@omsoo.design/todae/tokens.json`.

## Providers

Wrap the tree in `ThemeProvider` and `DensityProvider`. `appearance="system"` (default) writes `data-appearance="system"`, which follows `prefers-color-scheme` in CSS, so server-rendered HTML already matches the user's scheme. `useAppearance()` returns `light` or `dark` from `matchMedia`, and `light` on the server. `DensityProvider` writes `data-density` (`compact` | `comfortable` | `spacious`, default `comfortable`). Nested providers override. Both are optional: with neither, the page gets light and comfortable. Components read contract vars only.

```tsx
import { DensityProvider, ThemeProvider, Button } from '@omsoo.design/todae';

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

Open `/` for the full index, grouped as the sidebar is: Foundations (guides, Composition, `/tokens`, `/platform`), Components (one page per component, e.g. `/button` and `/link`), Utilities (one page per headless hook, `/utilities/*`; `useAppearance` and `useDensity` sit with their providers on `/tokens`), Recipes (`/recipes/*`) and Tools (`/playground`). Component and hook pages mount a live example and a props table from the schema. `/tokens` tables the generated catalog. `/playground` is a left-rail theme controller (presets, appearance + density selectors, raw / semantic / component token tabs, Copy JSON) and a right-stage live demo.

The docs come in English and Korean. English pages live in `apps/docs/app/(en)` at unprefixed URLs. Korean pages live in `apps/docs/app/ko` under `/ko`; every page is translated, and a page added later without a Korean version shows the English one under a notice. The header links to the same page in each language. To translate a page or add a language, see [`apps/docs/TRANSLATING.md`](apps/docs/TRANSLATING.md).

## Test

```sh
pnpm test
```

## Typecheck

```sh
pnpm typecheck
```

## Release

[Changesets](https://github.com/changesets/changesets) versions and publishes `@omsoo.design/todae`. A pull request that changes what the package ships adds a changeset:

```sh
pnpm changeset
```

Pick the bump and write a line for the changelog. Before 1.0, a breaking change is `minor` and everything else is `patch`. The changeset is a Markdown file in `.changeset/`; commit it with the change. CI runs `changeset status`, which fails when the package changed and the pull request adds no changeset. `changedFilePatterns` in `.changeset/config.json` leaves out tests, fixtures and snapshots, and changesets doesn't count dotfiles. For a change that ships nothing, add an empty changeset with `pnpm changeset --empty`.

`.github/workflows/release.yml` turns changesets on `main` into a "Version Packages" pull request that bumps the version and writes `packages/design-system/CHANGELOG.md`. Merging that pull request publishes the new version to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), from the `npm` environment. It needs:

- Actions › General › "Allow GitHub Actions to create and approve pull requests" turned on in the repository settings.
- The repository at `tounsoo/todae`, as `package.json` and `.changeset/config.json` name it.
- A GitHub App, so CI runs on the Version Packages pull request: GitHub starts no workflows for pushes made with the default `GITHUB_TOKEN`. Install the app on this repository with read and write access to contents and pull requests, then add its client ID as the Actions variable `RELEASE_APP_CLIENT_ID` and its private key as the secret `RELEASE_APP_PRIVATE_KEY`. Without them, the workflow opens the pull request with `GITHUB_TOKEN`.
- A trusted publisher on npm for this repository, `release.yml` and the `npm` environment. npm only takes one for a package that exists, so the first version is published by hand; until then the publish job fails.

## Deploy docs

Set the Vercel project Root Directory to `apps/docs`. `apps/docs/vercel.json` installs from the repo root, builds `@omsoo.design/todae`, then builds the docs app.

## Docs MCP

Streamable HTTP MCP at `https://todae.omsoo.design/api/mcp` (`apps/docs/app/api/[transport]`), for agents building a design system on Todae. The docs page [MCP server](apps/docs/app/(en)/mcp/page.mdx) shows how to connect each client.

```json
"todae": { "url": "https://todae.omsoo.design/api/mcp" }
```

Tools, in `apps/docs/lib/docs-mcp`:

- `list_components`, `get_component`, `when_to_use` read `@omsoo.design/todae/schema/components.json` and the English pages, `apps/docs/app/(en)/**/page.mdx`. A missing "When to use" section returns `status: "missing"` and is not inferred.
- `list_tokens`, `get_token` read the token catalog, `@omsoo.design/todae/tokens.json`.
- `get_contrast_pairs` runs `@omsoo.design/todae/tokens-builder` on Todae's `tokens/` folder. `build_tokens` and `scaffold_design_system` write token files to a temporary folder and run the built `todae-tokens` CLI on them in a child process, stopped after 10 seconds, then remove the folder; a server instance runs at most two builds at once. `next.config.mjs` traces the tokens folder and the CLI into the route. Both return results and write nothing to the caller's machine.
- `get_guide` returns the English source of the pages in `GUIDES` (`lib/docs-mcp/guides.ts`).

## Graft

Graft is a repo-root dev tool. It is not a runtime dependency. Cursor wiring
lives in `.cursor/` (always-apply rule, MCP pin `@nanonets/graft@0.18.0`, hooks).

```sh
pnpm graft:build
pnpm graft:check
```

`graft/` and `.graft/` stay on the machine that built them. Do not commit them.

## Layout

- `packages/design-system` is `@omsoo.design/todae`, the Vite library released to npm. Its own [README](packages/design-system/README.md) is the package's npm page.
- `apps/docs` is the Next.js 15 docs app with MDX examples.

Before adding a component, hook, recipe or token, read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the decisions they follow.

The component set is still growing and is not a finished design system.

## License

[MIT](LICENSE)
