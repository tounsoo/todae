# Todae

Todae is a low-level React design system that companies build their own design systems on. A company adds a token package, a few TypeScript declarations and thin wrappers around Todae's parts, without forking Todae.

Docs, live examples and a theme playground: [todae.omsoo.design](https://todae.omsoo.design)

Todae is on 0.x, so a minor release can break the API. The [changelog](https://github.com/tounsoo/todae/blob/main/packages/design-system/CHANGELOG.md) lists what each release changed and, for each breaking change, what to change in your code.

## Install

```sh
npm install @tounsoo/todae
```

Todae needs React 19, and its types need TypeScript 6 or later. An app made with create-next-app 16 starts on TypeScript 5, and npm then stops with a peer dependency error. Install TypeScript 6.0 with Todae, since typescript-eslint, which Next.js's ESLint config uses, accepts TypeScript below 6.1:

```sh
npm install @tounsoo/todae typescript@~6.0
```

## Use

Import the stylesheet once, then use the components.

```css
@import '@tounsoo/todae/todae.css';
```

```tsx
import { Button, ThemeProvider } from '@tounsoo/todae';

export function App() {
  return (
    <ThemeProvider appearance="system">
      <Button.Root>Save</Button.Root>
    </ThemeProvider>
  );
}
```

`todae.css` puts its rules in the `todae` cascade layer, so CSS outside a layer, such as a reset of your own, beats it. To use it with Tailwind CSS or a reset, see [CSS layers](https://todae.omsoo.design/guides/css-layers).

In Next.js, the main entry is a client module: a Server Component can render the providers, but parts such as `Button.Root` go in a file that starts with `'use client'`. [Get started](https://todae.omsoo.design/guides/get-started) covers this and the CSS order Next.js needs.

## What's in the package

- `@tounsoo/todae`: components, headless hooks and providers.
- `@tounsoo/todae/<name>`, such as `@tounsoo/todae/stack`: entries that a React Server Component can render.
- `@tounsoo/todae/todae.css`: the stylesheet, with every token as a CSS custom property.
- `@tounsoo/todae/tokens.json`: the token catalog.
- `@tounsoo/todae/schema/components.json`: each component's parts and props.
- The `todae-tokens` CLI and `@tounsoo/todae/tokens-builder`: build a company's tokens on top of Todae's. See [Build on Todae](https://todae.omsoo.design/guides/build-on-todae).

## For AI agents

An agent writing code with Todae can start here, since this README is also in `node_modules/@tounsoo/todae`.

- **MCP server:** `https://todae.omsoo.design/api/mcp` looks up Todae's components, recipes, tokens and the changes between releases, with no sign-in. In Claude Code, run `claude mcp add --transport http todae https://todae.omsoo.design/api/mcp`. Before writing code with a component, call the server's `get_docs_page` tool with the component's or hook's name, such as `Tooltip` or `useTooltip`: it returns the docs page with each example's code, which shows how the parts and hooks fit together. [MCP server](https://todae.omsoo.design/mcp) covers other clients and lists every tool.
- **Props for the installed version:** `@tounsoo/todae/schema/components.json` lists each part, hook and helper with its props. The MCP server describes the latest release, and on 0.x a minor release can break the API, so the installed schema wins where the two differ. The server's `get_changes` tool lists the breaking changes from the installed version to the latest.

Five things that habits from other React libraries get wrong:

1. Most components are namespaces of parts, such as `Button.Root` and `Dialog.Title`, so there is no plain `<Button>`. Providers such as `ThemeProvider` are plain components. The schema has the exact name of every part, hook and helper.
2. Tooltip and Popover keep the open state in a hook. Spread `getTriggerProps()` from `useTooltip` or `usePopover` on the trigger, and `getTooltipProps()` or `getPopoverProps()` on `Tooltip.Root` or `Popover.Root`, which only draw the surface. There is no `Tooltip.Trigger`, `Tooltip.Content`, `Popover.Trigger` or `Popover.Content`. Menu is different: it has `Menu.Trigger` and `Menu.Content`.
3. An icon-only `Button.Root` needs an `aria-label`, and it shows that label as its own tooltip, so it needs no Tooltip around it. To pair a button with `useTooltip`, pass `tooltip={false}`.
4. Don't rely on a tap to open a tooltip: on a phone or tablet, a tap opens no tip from `useTooltip` or `Button.Root`. Put anything a touch user must see in a Popover.
5. Recipes, such as a data table, a combobox or a command palette, are example code to copy, not exports: there is no `DataTable.*` or `Combobox.*`. Get a recipe's code with the server's `get_recipe` tool or from its docs page, such as [Data table](https://todae.omsoo.design/recipes/data-table).

## Browser support

Todae uses current browser features, such as CSS anchor positioning, the Popover API and `<dialog>`, and ships no polyfills for them. Calendar, the date and time pickers, `parseDate`, `parseDateRange`, `parseTime` and `parseDateTime` read the global `Temporal` object; to support a browser without it, install a Temporal polyfill globally. [Native platform](https://todae.omsoo.design/platform) says what happens without each feature it lists.

## License

[MIT](https://github.com/tounsoo/todae/blob/main/LICENSE)
