---
"@tounsoo/todae": minor
---

Every package entry now loads with `require()` as well as `import`, `@tounsoo/todae/package.json` is exported, and the repo-only token scripts and files no longer ship.

- `engines.node` is now `^20.19.0 || >=22.12.0`. Use Node 20.19, 22.12 or later.
- `todae-tokens self` is gone. It rebuilt Todae's own files inside the installed package; use `todae-tokens build --resolver <file>` for your tokens.
