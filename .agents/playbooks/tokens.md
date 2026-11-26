---
when: Any change on todae that touches a design token, the token source in packages/design-system/tokens, or the generated token files.
---

### Tokens

1. Do not change a design token unless Ben approves that change in his own message. Adding, removing, renaming or retyping a token, and changing its value, all count. Ask before you edit anything under `packages/design-system/tokens/`.
2. After an approved change, run `pnpm tokens` and commit the generated files. Then run `pnpm tokens:check`, which fails when the generated files are out of date. The Static job runs it for a change classed `all`.
3. Run `pnpm tokens:api:check`. It defaults to comparing `origin/main` with `HEAD`, and fails when a public token path disappeared or its type changed, including a path a later commit puts back. A rename drops the old path, so it fails the same way. The Token API job runs that script with the pull request's base and head, on drafts and on every change class but `markdown`. The same job also runs `pnpm --filter @tounsoo/todae tokens:check --base <pull request base>`, which ratchets token names against the base's grandfather list.
4. Read the Token consumers job's summary on the pull request. It lists the components that read a changed token. The job sets `continue-on-error`, so a failure there does not fail the build. Check those components yourself.
5. A token value change ships, so it gets a changeset that names the token, as `.agents/playbooks/changesets.md` says.
