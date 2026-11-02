---
extends:
when: Any change on todae that touches a design token, the token source in packages/design-system/tokens, or the generated token files.
---

### Tokens

1. Do not change a design token unless Ben approves that change in his own message. Adding, removing, renaming or retyping a token, and changing its value, all count. Ask before you edit anything under `packages/design-system/tokens/`.
2. After an approved change, run `pnpm tokens` and commit the generated files. Then run `pnpm tokens:check`, which fails when the generated files are out of date. The Static job runs it too.
3. Run `pnpm tokens:api:check`, which compares `origin/main` with `HEAD`. It fails when a public token path is removed, renamed or retyped. The Token API job runs the same check against the pull request's base, on drafts and docs-only pull requests too.
4. Read the Token consumers job's summary on the pull request. It lists the components that read a changed token and never fails, so check those components yourself.
5. A token value change ships, so it gets a changeset that names the token, as `.agents/playbooks/changesets.md` says.
