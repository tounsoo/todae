# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done:

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Ask Fable for advice before fixing anything. The goal is fewer review rounds, so Fable's job is to catch what would cause another round. Start an `Agent` with `model: "fable"` (Claude Fable, `claude-fable-5-1`) and give it the PR number, the review findings, and your diagnosis and fix plan for each one. Ask it, per finding:
   - Is it a real problem, or not worth fixing? Skip what Fable and you agree is not worth it, and say why in your summary.
   - Does the diagnosis name the root cause, or only the symptom the reviewer pointed at?
   - Does the same bug or pattern exist elsewhere in the PR that the fix should also cover?
   - Could the planned fix introduce a new problem the next review would flag, and are the planned tests enough?
   If the same finding, or a finding on code you changed in the last round, comes back, tell Fable so it can look for why the earlier fix did not hold. Fable only advises: it does not edit files, commit, or push. The session keeps the model it started with and does the fixing itself.
3. Fix every finding that is a real problem, following Fable's advice, all in one push. Add or update tests for each fix. If you decide a finding is not worth fixing, or you go against Fable's advice, say why in your summary.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
5. Push, then go back to step 1.
6. Stop only when a review returns nothing left to fix and CI is green on the latest commit.

Only then mark a draft PR ready for review and report back. A review that surfaced findings does not count as the final one: always run one more after the fixes land. When a review comes back clean, skip the Fable step for that round.
