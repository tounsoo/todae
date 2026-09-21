# `@tounsoo/todae-mcp`

stdio MCP server over the same `@tounsoo/todae/catalog.json` the package ships. Not a second schema.

```sh
pnpm build:ds
pnpm --filter @tounsoo/todae-mcp build
node packages/catalog-mcp/dist/cli.js
```

Cursor entry: `.cursor/mcp.json` → `todae-catalog` (`node packages/catalog-mcp/dist/cli.js`).

## Tools

Thin wrappers around `@tounsoo/todae/catalog`:

`list_components`, `get_component`, `list_patterns`, `get_pattern`, `list_for_intent`, `search`, `list_intents`, `to_render_catalog`, `to_candidate_recipe`, `to_criteria`.

## Resources

- `todae://catalog.json` — raw file bytes of `@tounsoo/todae/catalog.json`
- `todae://components/{name}`, `todae://patterns/{id}` — optional entry templates

## Soft-flag

Not plug-and-play Jev. No Graft, no secrets. Adapter tools return templates/criteria; the app still fills concrete props and request state.

## Blake

`src/parity.test.ts`: resource text === `readFileSync` of package `catalog.json`; bundled `catalog` === that file; get/list and wrapper outputs === package helpers; server source has no Jev / `$state` / graft.
