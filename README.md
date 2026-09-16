# Todae

What you need to do today.

Todae is a pnpm workspace. `@todae/design-system` is a private Vite library. `apps/docs` is a Next.js 15 app that renders live MDX examples from that library.

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

The build writes `packages/design-system/dist/index.js`, `index.d.ts`, and `todae.css`. The CSS file declares `@layer todae.reset, todae.base, todae.components`.

Watch the package while you edit it:

```sh
pnpm dev:ds
```

`dev:ds` does not rebuild `.d.ts` files. Run `pnpm build:ds` when you need fresh types.

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

Open `/`, `/button`, `/stack`, and `/text`. Each component page mounts a live example and a props table from the schema.

## Typecheck

```sh
pnpm typecheck
```

## Deploy docs

Set the Vercel project Root Directory to `apps/docs`. `apps/docs/vercel.json` installs from the repo root, builds `@todae/design-system`, then builds the docs app.

## Graft

Graft is a package-local dev tool under `packages/design-system`. It is not a runtime dependency.

```sh
cd packages/design-system
pnpm graft:build
pnpm graft:check
```

`graft/` and `.graft/` stay on the machine that built them. Do not commit them.

`packages/design-system/.cursor/mcp.json` may load only when that folder is the Cursor workspace root. `packages/design-system/.cursor/rules/graft.mdc` still applies when Cursor loads nested rules.

## Layout

- `packages/design-system` is `@todae/design-system`, a private Vite library.
- `apps/docs` is the Next.js 15 docs app with MDX examples.

Button, Stack, and Text are seed components that prove the pipeline. They are not a design system.
