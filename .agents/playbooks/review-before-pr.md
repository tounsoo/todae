---
extends: opening-a-pr
when: Opening, or adding new work to, a pull request on todae.
---

### Review before the pull request

Todae runs the review on the branch, so a pull request opens only after a clean round. Pushing the session's branch is fine at any time, because CI runs only on pull requests and `main`.

- **Replace** "Work from a git worktree off main." with: Work on the session's designated branch, cut from `main`.
- **Before** "Resolve the forge before the first PR operation" add the review round, repeated until a round has nothing to act on:
  1. Commit, then run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm tokens:check` and `pnpm schema`, which must leave no diff. Commit any fixes they need.
  2. Run `interrogate` on `<base>..HEAD`, where `<base>` is `git merge-base origin/main HEAD`. From the second round on, review only the commits since the last round, unless `origin/main` was merged in since, and give the reviewers the last round's **Act on** findings to check. Pass as context the code that directly depends on the range: importers of a changed export, CSS that uses a changed token, custom property or selector, tokens that alias a changed token, docs pages in both languages that describe the changed behavior, and the tests that cover it. Reviewers mark each finding as new on the branch or already on `main` at `<base>`.
  3. **Act on** findings block the pull request. One that was already on `main` blocks only if the branch touches that behavior or makes it worse; otherwise list it as a follow-up. Fix each with `principle-fix-root-causes` and a test per `principle-test-behavior-not-implementation`, commit, and start the next round. When an **Act on** finding comes back after a fix, apply `principle-attack-the-premise` before the next fix.
  4. A round with no **Act on** findings ends the loop. Mention **Consider** items in the reply. Fix plainly right ones only alongside a blocking fix.
- **Replace** "Open every PR ready, never as a draft." with: Open the PR ready, never as a draft, only after a clean round, and post its link then. New work on an open PR moves it back to draft first, goes through the review round, and then marks it ready again.
- **Replace** "Opening a PR does not start a babysit." with: Opening a PR starts the Babysit playbook in `drive` mode for that PR, as `.agents/playbooks/waiting-on-ci.md` adapts it.
