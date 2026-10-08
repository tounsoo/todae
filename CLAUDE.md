# Claude instructions

## Pull request review loop

After every push to a pull request, review it before calling it done. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

Each round's review runs in an `Agent` at that round's row of this table. The table is for the reviewer only: the advisor runs as step 4 says, and the fixes always run on the session's default model and effort.

| Round | `model` | `effort` | Command                          | What it reviews                          |
| ----- | ------- | -------- | -------------------------------- | ---------------------------------------- |
| 1     | `opus`  | `xhigh`  | `/code-review <pr-number> xhigh` | the whole PR                             |
| 2–5   | `opus`  | `high`   | `/code-review <pr-number> high`  | the commits pushed since the last review |

1. Start an `Agent` with this round's `model` and `effort` from the table, have it run this round's command, and return the findings. From round 2, give it the last reviewed commit, and it reports only findings that the commits after it introduced or failed to fix. The reviewer only reviews: it does not edit files, commit, or push. If the reviewer cannot run, tell the person in your next reply rather than reviewing at a different row.

   Trial: in round 1 of the next four PRs, also start a second reviewer `Agent` at `fable` / `medium` with the same command, in parallel. Fix the blocking findings from both. Then add a row for the PR to the Fable trial table in `/mnt/project-files/reviews/review-loop-analysis.md`: blocking findings from each reviewer, and how many only one of them found. Once the table has four rows, remove this paragraph.
2. Sort the findings. Only blocking findings start another round: a bug, a test or CI failure, or a statement in docs that is wrong about what the code does. Wording, style, missing edge-case caveats and other nits are not blocking: fix the ones that are plainly right in the same push, but they never start a round of their own.
3. Before fixing anything, work through each blocking finding:
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the PR? Fix it there too.
   - Could your fix introduce a new problem the next review would flag? Prefer the smallest fix. In docs, remove or narrow a wrong claim rather than adding new claims or examples, since every new claim is something the next review can find wrong.
   - Are your tests enough to catch a regression?
4. Ask an advisor for advice when the loop is stuck: a finding comes back after you fixed it, a new finding lands on code you changed in the last round, or you are about to start a third round. Start an `Agent` at `opus` / `xhigh` and give it the PR number, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to go through the step 3 questions, say why the earlier fixes did not hold, and say whether changing the design would end the loop sooner than another fix. The advisor only advises: it does not edit files, commit, or push. The session does the fixing itself, on its default model. If you go against the advisor's advice, say why in your summary. If the advisor cannot run, tell the person in your next reply rather than carrying on silently.
5. Fix every blocking finding, all in one push. Add or update tests for each fix.
6. Run `pnpm typecheck`, `pnpm test`, and `pnpm schema` (it must leave no diff) before pushing.
7. Push, then go back to step 1.
8. Stop when a review returns no blocking findings and CI is green on the latest commit.

Never run more than 5 rounds. If round 5 still has blocking findings, stop, leave the PR as a draft, and report back with the open findings and why they keep coming back, so the person can decide.

Once the loop stops clean, mark a draft PR ready for review and report back. A review that surfaced blocking findings does not count as the final one: always run one more after the fixes land.
