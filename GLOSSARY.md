# Todae glossary

Todae is a low-level React design system that companies build their own design systems on. These are the words its docs, decisions and reviews use. [`ARCHITECTURE.md`](ARCHITECTURE.md) has the rules behind them, and [Where a change goes](CONTRIBUTING.md#where-a-change-goes) lists the files each change touches. Decisions (ADRs) live in [`docs/decisions/`](docs/decisions/README.md).

## What Todae ships

**Component**:
An export whose markup, props and behavior Todae can fix without knowing the product's data, routing or layout. Anything that carries Todae tokens or styles is a **Component**.
_Avoid_: primitive

**Hook**:
Exported behavior with no markup, for a **Recipe** or a product's own markup to use.
_Avoid_: headless component

**Recipe**:
Copyable code on the docs site that puts **Components** and **Hooks** together around product data or flow. It is not a package export.
_Avoid_: pattern, template, composite component

**Namespace**:
The object a **Component** is exported as, holding its **Parts**, such as `Menu`. A component with no other parts is a **Namespace** with only a `Root`.

**Part**:
One member of a **Namespace**, such as `Menu.Item`. Every **Component** has a `Root` part.

**Variant**:
A different look of the same **Component**, chosen with a prop, such as `Loader.Root variant="dots"`. A look that only redraws an existing component is a **Variant**, not a new **Component**.

**Prop getter**:
A function a **Hook** returns that gives the props for one element, named `get<Element>Props`.

**Provider**:
A component that sets a value for everything inside it, such as the theme, density, strings or glyphs. Providers sit outside the **Component**, **Hook** and **Recipe** split.

## Entries

**Main entry**:
`@tounsoo/todae`, the package root. It is a client module.

**Server entry**:
A server-safe entry, `@tounsoo/todae/<slug>`, that a Server Component can import. It has no `'use client'`, no hooks and no context.

**Client wrapper**:
The `*.client` version of a **Component** that the **Main entry** exports when the component also has a **Server entry**, adding what needs a client **Provider** or hooks.

**Meta**:
The hand-written description of one exported **Part**, **Hook**, **Provider** or helper function: its name, description and props. The **Component schema** is built from every **Meta**.

**Component schema**:
The committed JSON list of every **Meta**, shipped with the package and read by the docs props tables and the **Docs MCP server**.

## Tokens

**Token**:
A DTCG design value. Each token path `a.b.c` becomes the custom property `--todae-a-b-c`. A token changes only with Ben's yes.

**Token layer**:
One of the four groups a **Token** belongs to, lowest first: core, appearance, density and contract.

**Core token**:
A raw scale value, such as a gray step or a font size.

**Appearance**:
Light or dark. Appearance tokens hold the semantic colors for each.
_Avoid_: theme (a **Theme** is the whole set of token values)

**Density**:
The spacing setting: compact, comfortable or spacious. Density tokens hold the spacing for each.

**Contract token**:
A **Token** a **Component** reads, named for that component, such as `badge.info.bg`.

**Token root**:
The first segment of a **Contract token**'s name, which says which **Component** owns it, such as `badge`.

**Slot**:
A named group in the token resolver that fixes a **Component**'s token shape, such as Button's states. An icon slot, such as `Button.Icon`, is a **Part**, not a token slot.

**Tone**:
A named color role a **Component** takes. Status tones are `info`, `success`, `warning` and `critical`. Category tones are `category-1` to `category-8`, numbered, not named for hues.
_Avoid_: color, intent

**Theme**:
A full set of **Token** values. Graphite is Todae's base theme. A company builds its own theme with `todae-tokens`.

**Public token API**:
The committed list of every public token path and its type. CI fails when a path is removed, renamed or retyped without Ben's approval.

**Second brand**:
Fernway, the example app in `examples/fernway` that themes Todae for a made-up company with **Tokens** only.

## Docs

**Docs page**:
One `page.mdx` on the docs site. English pages have no URL prefix; Korean pages sit under `/ko`.

**Korean twin**:
The Korean **Docs page** at the same slug as an English one. It changes in the same pull request as its English page.

**Stamp**:
A fingerprint of each English section that a **Korean twin** was translated from. The docs tests fail when an English section changed after its stamp.

**Docs example**:
One file that a **Docs page** renders live and shows as its own code.
_Avoid_: demo, story

**Docs MCP server**:
The MCP server the docs site serves, which answers questions about **Components**, **Recipes**, **Tokens** and docs pages.

## Process

**Changeset**:
A Markdown file that names the version bump and the changelog line for a change to what the package ships.

**Decision**:
A dated record of a choice and why, in `docs/decisions/`. A design-system rule also goes in `ARCHITECTURE.md`.
_Avoid_: `docs/adr/` (decisions live only in `docs/decisions/`)

**Change class**:
How CI sorts a pull request's diff: `all`, `prose` (only docs `page.mdx` files and their translation stamps) or `markdown` (only Markdown that no tool reads). The class decides which jobs run; [Check your change](CONTRIBUTING.md#check-your-change) has the details.

**Rule table**:
The list in `AGENTS.md` of each rule, the check that enforces it and its status.

**Weeds log**:
The log of mistakes that were caught, by review, by Ben or in production, kept to spot the ones that repeat.

**Verify**:
The repo's own procedure that proves a change on the commit it was tested at and ends in PASS, FAIL or BLOCKED.
