# Claude instructions

## Docs translations

The docs site is in English and Korean. A change to an English `page.mdx` in `apps/docs/app/(en)` also changes its Korean twin in `apps/docs/app/ko`, in the same pull request, then runs `pnpm --filter docs i18n:stamp ko <slug>`. `apps/docs/TRANSLATING.md` has the details.

## Pull request review loop

No pull request is opened until the review loop has cleared. Commit the work to the session's branch and review those commits; open the pull request and post its link only after a round comes back with no blocking findings. Pushing the branch itself is fine at any point, since CI runs only on pull requests and on `main`, and a pushed branch is not lost when the session ends. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

Each round's review runs in an `Agent` at that round's row of this table. `<base>` is `git merge-base origin/main HEAD`, so commits that landed on `main` after the branch started are not in the review. The table is for the reviewer only: the advisor runs as step 4 says, and the fixes always run on the session's default model and effort.

| Round | `model` | `effort` | Command                                          |
| ----- | ------- | -------- | ------------------------------------------------ |
| 1     | `opus`  | `xhigh`  | `/code-review xhigh <base>..HEAD`                |
| 2–5   | `opus`  | `high`   | `/code-review high <last-reviewed-commit>..HEAD` |

1. Commit the work, then start an `Agent` with this round's `model` and `effort` from the table, have it run this round's command, and return the findings. The reviewer only reviews: it does not edit files, commit, or push. If the reviewer cannot run, tell the person in your next reply rather than reviewing at a different row.

   From round 2, the command reviews only the commits made since the last review. Also give the reviewer the previous round's blocking findings, and have it say which are still open. If the branch was rebased or `origin/main` was merged in since the last review, have the reviewer run `/code-review high <base>..HEAD` instead.

2. Sort the findings. Only blocking findings start another round: a bug, a test or CI failure, or a statement in docs that is wrong about what the code does. Wording, style, missing edge-case caveats and other nits are not blocking: fix the ones that are plainly right along with the blocking fixes, but they never start a round of their own.
3. Before fixing anything, work through each blocking finding:
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the change? Fix it there too.
   - Could your fix introduce a new problem the next review would flag? Prefer the smallest fix. In docs, remove or narrow a wrong claim rather than adding new claims or examples, since every new claim is something the next review can find wrong.
   - Are your tests enough to catch a regression?
4. Ask an advisor for advice when the loop is stuck: a finding comes back after you fixed it, or you are about to start a third round. Start an `Agent` at `opus` / `xhigh` and give it the branch, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to go through the step 3 questions, say why the earlier fixes did not hold, and say whether changing the design would end the loop sooner than another fix. The advisor only advises: it does not edit files, commit, or push. The session does the fixing itself, on its default model. If you go against the advisor's advice, say why in your summary. If the advisor cannot run, tell the person in your next reply rather than carrying on silently.
5. Fix every blocking finding and commit the fixes. Add or update tests for each fix.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm tokens:check`, and `pnpm schema` (it must leave no diff), then go back to step 1.
7. When a review returns no blocking findings, the loop has cleared. If you commit anything after that review, including nit fixes or a fix for a step 6 check, go back to step 1 to review it. Otherwise push the branch, open the pull request as a draft, and post its link.

Never run more than 5 rounds. If round 5 still has blocking findings, stop without opening a pull request and report back with the open findings and why they keep coming back, so the person can decide. If they ask for a pull request anyway, open it as a draft and leave it as a draft until they say otherwise.

A review that surfaced blocking findings does not count as the final one: always run one more after the fixes land.

### After the pull request is open

Opening the pull request starts CI. Every later change, whether it fixes a CI failure or answers a review comment, is reviewed before it is pushed: commit it, run steps 1 to 6 with the round 2–5 row on the new commits, and push only when a review of them is clean. These rounds count toward the same 5-round limit. If the limit is reached with blocking findings still open, leave the pull request as a draft and report back as above. Once CI is green on the latest commit and the last review was clean, mark the draft ready for review and report back.
