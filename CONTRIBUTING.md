# Contributing to Todae

This guide covers setting up the repository, the commands you run while you work, and what a pull request needs.

Before you add or change a component, hook, recipe, token or docs page, read [`ARCHITECTURE.md`](ARCHITECTURE.md). It records the concepts and decisions new work follows. When your change settles a new question, add the decision there in the same pull request.

## Repository layout

Todae is a pnpm workspace:

- `packages/design-system` is `@tounsoo/todae`, the Vite library released to npm. Its [README](packages/design-system/README.md) is the package's npm page.
- `apps/docs` is the Next.js 15 docs site. It renders live MDX examples from the library and serves the docs MCP server.
- `examples/fernway` is a small Vite app that themes Todae for a made-up company with tokens only. Its [README](examples/fernway/README.md) says how to run it.

## Set up

You need:

- Node 22. `nvm use` reads `.nvmrc`.
- pnpm 10. The `packageManager` field in the root `package.json` pins the version.

Install the dependencies:

```sh
pnpm install
```

## Build the design system

The docs site compiles the package from source, but the docs unit tests and the MCP server's token build use the built `dist/` files, so build the package first:

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

The DTCG token source lives in `packages/design-system/tokens/`. The build emits CSS custom property chains, not resolved values, and a JSON token catalog.

```sh
pnpm tokens
pnpm tokens:check
```

Commit the generated files. `tokens:check` fails when they are out of date.

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

- The docs unit tests import the built package, so run `pnpm build:ds` before `pnpm test` in a fresh checkout.
- `pnpm test:browser` runs the `*.browser.test.tsx` files in both workspaces in Chromium through Playwright. Install Chromium once first with `pnpm --filter @tounsoo/todae exec playwright install --with-deps chromium`. Behavior that needs real layout, focus or the top layer goes there. [`ARCHITECTURE.md`](ARCHITECTURE.md#tests) says where other tests go.
- `pnpm --filter docs test:visual:docker` compares screenshots of the built docs site with the baselines in `apps/docs/visual/baselines`: every example in light and dark, and the home, Button and playground pages in English and Korean on desktop and phone. It runs in Playwright's Docker image, the one CI uses, since fonts and rendering differ between machines, so build the package and the docs first and have Docker running. It needs a Linux x64 host. When a change is meant to look different, add `--update-snapshots` and commit the new images; when you rename a heading or remove an example, delete its old images too. A failing CI run uploads a `screenshots` artifact: open `playwright-report/index.html` to see each change, and copy a shot's `test-results/**/<name>-actual.png` over its baseline to accept it, which is the way to update baselines without a Linux x64 host.

## Changesets

[Changesets](https://github.com/changesets/changesets) versions and publishes `@tounsoo/todae`. A pull request that changes what the package ships adds a changeset:

```sh
pnpm changeset
```

Pick the bump and write the changelog entry. Before 1.0, a breaking change is `minor` and everything else is `patch`. The changeset is a Markdown file in `.changeset/`; commit it with the change.

Keep the entry short. The first line says what changed for people who use Todae, in one sentence that names the component, hook or token. Leave out why, how and edge cases: the pull request and the docs have those. A breaking change adds one bullet per break, saying what to change in your code:

```md
---
'@tounsoo/todae': minor
---

useCombobox names its listbox by the field's Label.

- Spread `getLabelProps()` on the Label, or pass `aria-label` to `getListboxProps()`.
- `getTriggerProps().ref` is a callback ref; read `cb.triggerRef` for the element.
```

CI runs `changeset status`, which fails when the package changed and the pull request adds no changeset. `changedFilePatterns` in `.changeset/config.json` leaves out tests, fixtures, snapshots and `CHANGELOG.md`, and Changesets doesn't count dotfiles. For a change that ships nothing but still trips the check, add an empty changeset with `pnpm changeset --empty`.

## Pull requests

- Keep a pull request to one change.
- Include the tests, docs (in both languages) and changeset the change needs.
- CI skips draft pull requests. Mark yours ready for review when you want CI to run.

## Releases

Merging a pull request with changesets doesn't publish. `.github/workflows/release.yml` turns the changesets on `main` into a "Version Packages" pull request that bumps the version and writes `packages/design-system/CHANGELOG.md`. Merging that pull request publishes the new version to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), from the `npm` environment. It needs:

- Actions › General › "Allow GitHub Actions to create and approve pull requests" turned on in the repository settings.
- The repository at `tounsoo/todae`, as `package.json` and `.changeset/config.json` name it.
- A GitHub App, which moves `docs-stable` (see [Deploy the docs](#deploy-the-docs)) and lets CI run on the Version Packages pull request: GitHub starts no workflows for pushes made with the default `GITHUB_TOKEN`, and refuses it any ref update that adds or changes a workflow file. Install the app on this repository with read and write access to contents, pull requests and workflows, then add its client ID as the Actions variable `RELEASE_APP_CLIENT_ID` and its private key as the secret `RELEASE_APP_PRIVATE_KEY`. Without them, the workflow opens the pull request with `GITHUB_TOKEN`, and the docs job fails.
- A trusted publisher on npm for this repository, `release.yml` and the `npm` environment.

## Deploy the docs

The Vercel project's Root Directory is `apps/docs`. `apps/docs/vercel.json` installs from the repository root, builds `@tounsoo/todae`, then builds the docs app.

The production branch is `docs-stable`, so `todae.omsoo.design` and its MCP server match the latest release on npm. The docs job in `release.yml` runs on every push to `main` and moves `docs-stable` forward, never back: to that commit when its package version is on npm and no changeset that releases something is waiting, otherwise to the commit tagged with the latest version on npm. The first run creates the branch, so set Vercel's production branch to `docs-stable` only after it exists. It waits behind a release that waits for approval in the `npm` environment. If the job fails, re-run it; after a publish it fails when npm still doesn't serve the new version five minutes later. To see unreleased docs, open the Vercel preview of a pull request or of `main`.

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
