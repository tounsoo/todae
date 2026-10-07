# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done:

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Ask Fable for advice before fixing anything. Start an `Agent` with `model: "fable"` (Claude Fable, `claude-fable-5-1`) and give it the PR number, the review findings, and your diagnosis and fix plan for each one. Ask it to say, per finding, whether it is a real problem, whether your diagnosis names the root cause, and whether the planned fix and tests are right. Fable only advises: it does not edit files, commit, or push. The session keeps the model it started with and does the fixing itself.
3. Fix every finding that is a real problem, following Fable's advice. Add or update tests for each fix. If you decide a finding is not worth fixing, or you go against Fable's advice, say why in your summary.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
5. Push, then go back to step 1.
6. Stop only when a review returns nothing left to fix and CI is green on the latest commit.

Only then mark a draft PR ready for review and report back. A review that surfaced findings does not count as the final one: always run one more after the fixes land. When a review comes back clean, skip the Fable step for that round.
