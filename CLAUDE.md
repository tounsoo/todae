# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done:

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Fix every finding that is a real problem. Add or update tests for each fix. If you decide a finding is not worth fixing, say why in your summary.
3. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
4. Push, then go back to step 1.
5. Stop only when a review returns nothing left to fix and CI is green on the latest commit.

Only then mark a draft PR ready for review and report back. A review that surfaced findings does not count as the final one: always run one more after the fixes land.
