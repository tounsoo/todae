# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

1. Run the `code-review` skill on the PR (for example `/code-review <pr-number> high`).
2. Sort the findings. Only blocking findings start another round: a bug, a test or CI failure, or a statement in docs that is wrong about what the code does. Wording, style, missing edge-case caveats and other nits are not blocking: fix the ones that are plainly right in the same push, but they never start a round of their own.
3. Before fixing anything, work through each blocking finding:
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the PR? Fix it there too.
   - Could your fix introduce a new problem the next review would flag? Prefer the smallest fix. In docs, remove or narrow a wrong claim rather than adding new claims or examples, since every new claim is something the next review can find wrong.
   - Are your tests enough to catch a regression?
4. Ask an Opus advisor for advice when the loop is stuck: a finding comes back after you fixed it, a new finding lands on code you changed in the last round, or you are about to start a third round. Start an `Agent` with `model: "opus"` and `effort: "high"` and give it the PR number, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to go through the step 3 questions and say why the earlier fixes did not hold. The advisor only advises: it does not edit files, commit, or push. The session keeps the model it started with and does the fixing itself. If you go against the advisor's advice, say why in your summary. If the advisor cannot run, tell the person in your next reply rather than carrying on silently.
5. Fix every blocking finding, all in one push. Add or update tests for each fix.
6. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
7. Push, then go back to step 1.
8. Stop when a review returns no blocking findings and CI is green on the latest commit.

Never run more than 4 rounds. If round 4 still has blocking findings, stop, leave the PR as a draft, and report back with the open findings and why they keep coming back, so the person can decide.

Once the loop stops clean, mark a draft PR ready for review and report back. A review that surfaced blocking findings does not count as the final one: always run one more after the fixes land.
