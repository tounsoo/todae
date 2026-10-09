# Claude instructions

## Docs translations

The docs site is in English and Korean. A change to an English `page.mdx` in `apps/docs/app/(en)` also changes its Korean twin in `apps/docs/app/ko`, in the same pull request, then runs `pnpm --filter docs i18n:stamp ko <slug>`. `apps/docs/TRANSLATING.md` has the details.

## Pull request review loop

Open the pull request, and post its link, only after a review round comes back with no blocking findings. Until then, commit to the session's branch and push it as usual. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

Each round's review runs in an `Agent` at that round's row of this table. `<base>` is `git merge-base origin/main HEAD`, so commits that landed on `main` after the branch started are not in the review. The table is for the reviewer only: the advisor runs as step 4 says, and the fixes always run on the session's default model and effort.

| Round | `model` | `effort` | Command                                          |
| ----- | ------- | -------- | ------------------------------------------------ |
| 1     | `opus`  | `xhigh`  | `/code-review xhigh <base>..HEAD`                |
| 2–5   | `opus`  | `high`   | `/code-review high <last-reviewed-commit>..HEAD` |

1. Commit the work and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm tokens:check`, and `pnpm schema` (it must leave no diff), committing any fixes they need. Then start an `Agent` with this round's `model` and `effort` from the table, have it run this round's command, and return the findings. The reviewer only reviews: it does not edit files, commit, or push. If the reviewer cannot run, tell the person in your next reply rather than reviewing at a different row.

   From round 2, the command reviews only the commits made since the last review. Also give the reviewer the previous round's blocking findings, and have it say which are still open. If the branch was rebased or `origin/main` was merged in since the last review, have the reviewer run `/code-review high <base>..HEAD` instead.

2. Sort the findings. Only blocking findings start another round: a bug, a test or CI failure, or a statement in docs that is wrong about what the code does. Wording, style, missing edge-case caveats and other nits are not blocking: fix the ones that are plainly right along with the blocking fixes, but they never start a round of their own. In a round with no blocking findings, leave the nits.
3. Before fixing anything, work through each blocking finding:
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the change? Fix it there too.
   - Could your fix introduce a new problem the next review would flag? Prefer the smallest fix. In docs, remove or narrow a wrong claim rather than adding new claims or examples, since every new claim is something the next review can find wrong.
   - Are your tests enough to catch a regression?
4. Ask an advisor for advice when the loop is stuck: a finding comes back after you fixed it, or you are about to start a third round. Start an `Agent` at `opus` / `xhigh` and give it the branch, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to go through the step 3 questions, say why the earlier fixes did not hold, and say whether changing the design would end the loop sooner than another fix. The advisor only advises: it does not edit files, commit, or push. The session does the fixing itself, on its default model. If you go against the advisor's advice, say why in your summary. If the advisor cannot run, tell the person in your next reply rather than carrying on silently.
5. Fix every blocking finding and commit the fixes. Add or update tests for each fix. Then go back to step 1.
6. When a round returns no blocking findings, push the branch. If no pull request is open yet, open one as a draft and post its link. If CI fails or a comment on the pull request needs a change, fix it and push; once CI is green, go back to step 1 to review the commits since the last clean round. When CI is green on the latest commit and every commit has been through a clean round, mark the draft ready for review and report back.

Never run more than 5 rounds in all, before and after the pull request opens. If round 5 still leaves blocking findings or unreviewed commits, stop and report back with what is open and why it keeps coming back, so the person can decide. Don't open a pull request then; if one is open, or the person asks for one anyway, leave it as a draft until they say otherwise.

A review that surfaced blocking findings does not count as the final one: always run one more after the fixes land.
