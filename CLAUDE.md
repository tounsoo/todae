# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done:

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Consult the advisor before fixing anything. This repo sets Fable as the advisor in `.claude/settings.json`, so the session keeps the model it started with and Fable only advises. Call the advisor with the review findings and your diagnosis and fix plan for each one, and ask whether each finding is a real problem, whether the diagnosis names the root cause, and whether the planned fix and tests are right. Consult it again before declaring the loop done. Outside this loop, do not call the advisor unless the person asks.
3. Fix every finding that is a real problem, following the advisor's advice. Add or update tests for each fix. If you decide a finding is not worth fixing, or you go against the advisor's advice, say why in your summary.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
5. Push, then go back to step 1.
6. Stop only when a review returns nothing left to fix and CI is green on the latest commit.

Only then mark a draft PR ready for review and report back. A review that surfaced findings does not count as the final one: always run one more after the fixes land. When a review comes back clean, skip the advisor step for that round.
