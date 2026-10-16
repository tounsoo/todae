# Contributing to Todae

This guide covers setting up the repository, the commands you run while you work, and what a pull request needs.

Before you add or change a component, hook, recipe, token or docs page, read [`ARCHITECTURE.md`](ARCHITECTURE.md). It records the concepts and decisions new work follows. When your change settles a new question, add the decision there in the same pull request.

## Repository layout

Todae is a pnpm workspace:

- `packages/design-system` is `@tounsoo/todae`, the Vite library released to npm. Its [README](packages/design-system/README.md) is the package's npm page.
- `apps/docs` is the Next.js 15 docs site. It renders live MDX examples from the library and serves the docs MCP server.

## Set up

You need:

- Node 22. `nvm use` reads `.nvmrc`.
- pnpm 10. The `packageManager` field in the root `package.json` pins the version.

Install the dependencies:

```sh
pnpm install
```

## Build the design system

The docs site compiles the package from source, but the docs unit tests, some docs browser tests and the MCP server's token tools import the built `dist/` files, so build the package first:

```sh
pnpm build:ds
```

The build writes `packages/design-system/dist/index.js`, `index.d.ts` and `todae.css`. The CSS file declares `@layer todae.reset, todae.base, todae.components` and includes the generated token variables.

To rebuild the package while you edit it:

```sh
pnpm dev:ds
```

`dev:ds` does not rebuild the `.d.ts` files. Run `pnpm build:ds` when you need fresh types.

## Run the docs

```sh
pnpm build:ds
pnpm dev:docs
```

`pnpm dev` is the same as `pnpm dev:docs`.

`/` is the index, grouped as the sidebar is: Foundations, Components, Utilities, Recipes and Tools. Component and hook pages show a live example and a props table generated from the component schema.

The docs are in English and Korean. English pages live in `apps/docs/app/(en)` at unprefixed URLs, and Korean pages live in `apps/docs/app/ko` under `/ko`. A change to an English `page.mdx` also changes its Korean page in the same pull request. [`apps/docs/TRANSLATING.md`](apps/docs/TRANSLATING.md) says how to translate a page and stamp it.

## Tokens

The DTCG token source lives in `packages/design-system/tokens/`. The build emits CSS custom property chains, not resolved values, and `tokens/tokens.generated.json`.

```sh
pnpm tokens
pnpm tokens:check
```

Commit both generated files, `tokens/tokens.generated.json` and `src/styles/tokens.generated.css`. `tokens:check` fails when they are out of date.

The token layers apply in this order:

1. Core: literals on `:root`.
2. Appearance: `[data-appearance]`, and light on a `:root` without that attribute.
3. Density: `[data-density]`, and comfortable on a `:root` without that attribute.
4. Contract: `:root, [data-appearance], [data-density]`.
5. Button variants: `[data-button-variant]`.

A token path `a.b.c` becomes the custom property `--todae-a-b-c`.

## Component schema

```sh
pnpm schema
```

The generator reads `packages/design-system/src/**/*.meta.ts` and writes `packages/design-system/schema/components.json`. Commit that file. Running `pnpm schema` again must leave no diff.

## Check your change

Run these before you open a pull request. CI runs them too, and builds the docs.

```sh
pnpm typecheck
pnpm lint
pnpm tokens:check
pnpm schema
pnpm test
pnpm test:browser
```

- The docs tests import the built package, so run `pnpm build:ds` before `pnpm test` in a fresh checkout.
- `pnpm test:browser` runs the package's `src/**/*.browser.test.tsx` and the docs demo tests, with axe, in Chromium through Playwright. Install Chromium once first with `pnpm --filter @tounsoo/todae exec playwright install --with-deps chromium`. Behavior that needs real layout, focus or the top layer goes there. [`ARCHITECTURE.md`](ARCHITECTURE.md#tests) says where other tests go.

## Changesets

[Changesets](https://github.com/changesets/changesets) versions and publishes `@tounsoo/todae`. A pull request that changes what the package ships adds a changeset:

```sh
pnpm changeset
```

Pick the bump and write a line for the changelog, written for people who use Todae. Before 1.0, a breaking change is `minor` and everything else is `patch`. The changeset is a Markdown file in `.changeset/`; commit it with the change.

CI runs `changeset status`, which fails when the package changed and the pull request adds no changeset. `changedFilePatterns` in `.changeset/config.json` leaves out tests, fixtures and snapshots, and Changesets doesn't count dotfiles. For a change that ships nothing but still trips the check, add an empty changeset with `pnpm changeset --empty`.

## Pull requests

- Keep a pull request to one change.
- Include the tests, docs (in both languages) and changeset the change needs.
- CI skips draft pull requests. Mark yours ready for review when you want CI to run.

## Releases

Merging to `main` doesn't publish. `.github/workflows/release.yml` turns the changesets on `main` into a "Version Packages" pull request that bumps the version and writes `packages/design-system/CHANGELOG.md`. Merging that pull request publishes the new version to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), from the `npm` environment. It needs:

- Actions › General › "Allow GitHub Actions to create and approve pull requests" turned on in the repository settings.
- The repository at `tounsoo/todae`, as `package.json` and `.changeset/config.json` name it.
- A GitHub App, so CI runs on the Version Packages pull request: GitHub starts no workflows for pushes made with the default `GITHUB_TOKEN`. Install the app on this repository with read and write access to contents and pull requests, then add its client ID as the Actions variable `RELEASE_APP_CLIENT_ID` and its private key as the secret `RELEASE_APP_PRIVATE_KEY`. Without them, the workflow opens the pull request with `GITHUB_TOKEN`.
- A trusted publisher on npm for this repository, `release.yml` and the `npm` environment.

## Deploy the docs

The Vercel project's Root Directory is `apps/docs`. `apps/docs/vercel.json` installs from the repository root, builds `@tounsoo/todae`, then builds the docs app.

## Docs MCP server

The docs site serves a Streamable HTTP MCP server at `https://todae.omsoo.design/api/mcp`, from `apps/docs/app/api/[transport]`. The [MCP server](apps/docs/app/(en)/mcp/page.mdx) docs page shows how to connect each client. The tools live in `apps/docs/lib/docs-mcp`:

- `list_components`, `get_component` and `when_to_use` read `@tounsoo/todae/schema/components.json` and the English pages, `apps/docs/app/(en)/**/page.mdx`. A missing "When to use" section returns `status: "missing"` and is not inferred.
- `list_tokens` and `get_token` read the token catalog, `@tounsoo/todae/tokens.json`.
- `get_contrast_pairs` runs `@tounsoo/todae/tokens-builder` on Todae's `tokens/` folder. `build_tokens` and `scaffold_design_system` write token files to a temporary folder and run the built `todae-tokens` CLI on them in a child process, stopped after 10 seconds, then remove the folder; a server instance runs at most two builds at once. `next.config.mjs` traces the tokens folder and the CLI into the route. Both return results and write nothing to the caller's machine.
- `get_guide` returns the English source of the pages in `GUIDES` (`lib/docs-mcp/guides.ts`).

## Graft

Graft is a dev tool at the repository root, not a runtime dependency. Its Cursor wiring lives in `.cursor/`: an always-apply rule, the MCP pin `@nanonets/graft@0.18.0` and hooks.

```sh
pnpm graft:build
pnpm graft:check
```

`graft/` and `.graft/` stay on the machine that built them. Don't commit them.

## License

Todae is [MIT](LICENSE) licensed.
