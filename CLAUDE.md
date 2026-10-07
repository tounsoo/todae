# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Before fixing anything, work through each finding:
   - Is it a real problem, or not worth fixing? Skip what is not worth it, and say why in your summary.
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the PR? Fix it there too.
   - Could your fix introduce a new problem the next review would flag, and are your tests enough to catch a regression?
3. Ask Fable for advice when the loop is stuck: a finding comes back after you fixed it, a new finding lands on code you changed in the last round, or you are about to start a third round. Start an `Agent` with `model: "fable"` (Claude Fable, `claude-fable-5-1`) and give it the PR number, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to go through the step 2 questions and say why the earlier fixes did not hold. Fable only advises: it does not edit files, commit, or push. The session keeps the model it started with and does the fixing itself. If you go against Fable's advice, say why in your summary.
4. Fix every finding that is a real problem, all in one push. Add or update tests for each fix.
5. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
6. Push, then go back to step 1.
7. Stop only when a review returns nothing left to fix and CI is green on the latest commit.

Only then mark a draft PR ready for review and report back. A review that surfaced findings does not count as the final one: always run one more after the fixes land.
